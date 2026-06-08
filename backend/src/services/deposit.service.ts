import prisma from '../lib/prisma';
import { creditWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyAgent, notifyUser } from '../bot/notifier';

export async function createDepositRequest(
  userId: string,
  amount: number,
  reference?: string,
  screenshotUrl?: string
) {
  if (amount <= 0) throw new Error('Deposit amount must be positive');

  const deposit = await prisma.deposit.create({
    data: { 
      userId, 
      amount, 
      txnId: reference || `DEP-${Date.now()}`, 
      receiptUrl: screenshotUrl, 
      status: 'pending' 
    },
    include: { user: { select: { username: true, referredBy: true } } },
  });

  // Notify Global Admin
  await triggerAdminEvent('new-deposit', {
    depositId: deposit.id,
    userId,
    amount,
    userName: deposit.user?.username || 'User',
    reference,
  });

  // If user has an agent (referredBy), notify that specific agent channel too
  if (deposit.user?.referredBy) {
    const referrer = await prisma.user.findUnique({ where: { id: deposit.user.referredBy }, select: { role: true } });
    if (referrer && (referrer.role === 'AGENT' || referrer.role === 'ADMIN' || referrer.role === 'admin')) {
      await triggerUserEvent(deposit.user.referredBy, 'agent-new-deposit', {
        depositId: deposit.id,
        userId,
        amount,
        userName: deposit.user?.username || 'User',
      });

      // Notify agent on Telegram
      await notifyAgent(
        deposit.user.referredBy,
        `🔔 <b>አዲስ የብር ገቢ ጥያቄ (New Deposit Request)</b>\n\n` +
        `👤 <b>ተጫዋች (Player):</b> ${deposit.user?.username || 'Unknown'}\n` +
        `💰 <b>መጠን (Amount):</b> ${amount} ETB\n` +
        `🔖 <b>ማጣቀሻ (Ref):</b> ${reference || 'N/A'}\n\n` +
        `እባክዎ ወደ ኤጀንት ፖርታልዎ በመግባት ያረጋግጡ።`
      );
    }
  }

  logger.info(`Deposit request: user ${userId}, amount ${amount}, ref ${reference}`);

  // Attempt immediate automated scraping/verification
  const isTelebirrId = /^[A-Z0-9]{10}$/.test(deposit.txnId || '');
  if (isTelebirrId) {
    // Run verification asynchronously in the background so it doesn't block the HTTP request response
    (async () => {
      try {
        const { verifyReceiptOnline } = await import('./bunafrankValidator');
        const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${deposit.txnId}`;
        logger.info(`[AutoDeposit] Submitting background auto-verification for ${deposit.txnId}...`);
        const verified = await verifyReceiptOnline(receiptUrl, deposit.txnId);
        if (verified) {
          logger.info(`[AutoDeposit] Background verified successfully! Auto-approving deposit #${deposit.id}`);
          const systemAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'admin'] } } });
          if (systemAdmin) {
            await approveDeposit(deposit.id, systemAdmin.id);
          } else {
            logger.error(`[AutoDeposit] Cannot auto-approve deposit #${deposit.id} because no ADMIN user exists in the DB.`);
          }
        }
      } catch (err) {
        logger.error(`[AutoDeposit] Background verifier failed for ${deposit.txnId}:`, err);
      }
    })();
  }

  return deposit;
}

export async function approveDeposit(depositId: string, adminId: string) {
  const deposit = await prisma.deposit.findUnique({ 
    where: { id: depositId },
    include: { user: { select: { username: true, referredBy: true } } }
  });
  if (!deposit) throw new Error('Deposit not found');

  // Guard against double-processing
  if (deposit.status === 'approved') throw new Error('Deposit already approved');
  if (deposit.status === 'rejected') throw new Error('Deposit already rejected');

  // If the bot already auto-completed this deposit (credited wallet), just mark approved — no double-credit
  const alreadyCredited = deposit.status === 'completed';

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'approved' },
  });

  if (deposit.userId) {
    if (!alreadyCredited) {
      await creditWallet(deposit.userId, deposit.amount, 'DEPOSIT', depositId, 'Deposit approved');

      // ─── Deposit Bonus (Dynamic based on system settings) ───
      const { isDepositBonusEligible } = await import('./settings.service');
      const { percentage: bonusPercentage } = await isDepositBonusEligible(Number(deposit.amount));
      const { creditBonus } = await import('./wallet.service');
      const bonusAmount = Number(deposit.amount) * (bonusPercentage / 100);

      if (bonusAmount > 0) {
        await creditBonus(deposit.userId, bonusAmount, `Deposit bonus (${bonusPercentage}%) for request #${depositId}`);
      }

      await prisma.adminLog.create({
        data: { adminId, targetUserId: deposit.userId, action: 'APPROVE_DEPOSIT', details: { depositId, amount: deposit.amount, bonus: bonusAmount } },
      });

      await triggerUserEvent(deposit.userId, 'deposit-approved', {
        depositId,
        amount: deposit.amount.toString(),
        bonus: bonusAmount.toFixed(2),
      });

      // Notify User on Telegram
      let msgText = `✅ <b>የብር ገቢ ተረጋግጧል! (Deposit Approved)</b>\n\n` +
                    `💵 መጠን (Amount): <b>${Number(deposit.amount).toFixed(2)} ETB</b>\n`;
      if (bonusAmount > 0) {
        msgText += `🎁 ቦነስ (Bonus): <b>${bonusAmount.toFixed(2)} ETB (${bonusPercentage}%)</b>\n\n`;
      } else {
        msgText += `\n`;
      }
      msgText += `ሂሳብዎ ገቢ ሆኗል። አሁኑኑ ተጫውተው ያሸንፉ! 🎰`;

      await notifyUser(deposit.userId, msgText);
    } else {
      // Bot already auto-credited — log it, skip wallet credit to avoid double-crediting
      logger.info(`[Deposit] Skipping wallet credit for ${depositId} — already auto-credited by bot.`);
      await prisma.adminLog.create({
        data: { adminId, targetUserId: deposit.userId, action: 'APPROVE_DEPOSIT', details: { depositId, amount: deposit.amount, note: 'auto-credited by bot, no re-credit' } },
      });
    }
  }

  logger.info(`Deposit approved: ${depositId} by admin/agent ${adminId}`);
}

export async function rejectDeposit(depositId: string, adminId: string, reason: string) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.status !== 'pending') throw new Error('Deposit already processed');

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'rejected', details: reason },
  });

  if (deposit.userId) {
    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: deposit.userId, action: 'REJECT_DEPOSIT', details: { depositId, reason } },
    });

    await triggerUserEvent(deposit.userId, 'deposit-rejected', { depositId, reason });

    // Notify User on Telegram
    await notifyUser(
      deposit.userId,
      `❌ <b>የብር ገቢ አልተሳካም (Deposit Rejected)</b>\n\n` +
      `💵 መጠን (Amount): <b>${Number(deposit.amount).toFixed(2)} ETB</b>\n` +
      `📝 ምክንያት (Reason): ${reason}\n\n` +
      `እባክዎ መረጃውን አረጋግጠው በድጋሚ ይሞክሩ ወይም ድጋፍ ሰጪን ያነጋግሩ። 🙏`
    );
  }
  logger.info(`Deposit rejected: ${depositId} — ${reason}`);
}

export async function getPendingDeposits(agentId?: string) {
  return prisma.deposit.findMany({
    where: { 
      user: agentId ? { referredBy: agentId } : undefined
    },
    include: { user: { select: { username: true, telegramId: true, telegramUsername: true, firstName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUserDeposits(userId: string) {
  return prisma.deposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

