import { Context, Markup } from 'telegraf';
import { isAdmin } from '../../services/user.service';
import { getPendingDeposits, approveDeposit, rejectDeposit } from '../../services/deposit.service';
import { getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from '../../services/withdrawal.service';
import { getUserByTelegramId } from '../../services/user.service';
import prisma from '../../lib/prisma';
import { config } from '../../config';

// Super-admin Telegram username — always has full staff access
const SUPER_ADMIN_TG_USERNAME = 'sisay_2121';

/**
 * Helper to ensure the user is either an Admin, an Agent, or the super-admin (@sisay_2121).
 * Returns the DB user ID if authorized (or a placeholder for the super-admin).
 */
async function requireStaff(ctx: Context): Promise<string | null> {
  const tgUser = ctx.from!;

  // ── Super-admin bypass: @sisay_2121 always has full access ──────────────────
  if (tgUser.username === SUPER_ADMIN_TG_USERNAME) {
    // Try to get their DB ID; fall back to a placeholder so callers always get a string
    const adminUser = await getUserByTelegramId(tgUser.id).catch(() => null);
    return adminUser?.id ?? `tg_superadmin_${tgUser.id}`;
  }

  const user = await getUserByTelegramId(tgUser.id);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT')) {
    await ctx.reply('❌ Unauthorized. Staff only.');
    return null;
  }
  return user.id;
}

export async function handleAdminPanel(ctx: Context) {
  const tgUser = ctx.from!;
  if (!isAdmin(tgUser.id)) return ctx.reply('❌ Unauthorized.');

  const [pendingDeposits, pendingWithdrawals, totalUsers, activeGames] = await Promise.all([
    prisma.deposit.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.user.count(),
    prisma.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
  ]);

  await ctx.reply(
    `🛡️ *Admin Panel*\n\n` +
    `📥 Pending Deposits: *${pendingDeposits}*\n` +
    `📤 Pending Withdrawals: *${pendingWithdrawals}*\n` +
    `👥 Total Users: *${totalUsers}*\n` +
    `🎮 Active Games: *${activeGames}*\n`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(`📥 Deposits (${pendingDeposits})`, 'admin_deposits'),
          Markup.button.callback(`📤 Withdrawals (${pendingWithdrawals})`, 'admin_withdrawals'),
        ],
        [Markup.button.webApp('📊 Full Dashboard', `${config.bot.miniAppUrl}/admin`)],
      ]),
    }
  );
}

export async function handleAdminDeposits(ctx: Context) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;

  const deposits = await getPendingDeposits();
  if (!deposits.length) {
    return ctx.reply('✅ No pending deposits.');
  }

  for (const dep of deposits.slice(0, 5)) {
    const userName = dep.user.telegramUsername ? `@${dep.user.telegramUsername}` : dep.user.firstName;
    await ctx.reply(
      `📥 *Deposit Request*\n\n` +
      `👤 User: ${userName}\n` +
      `💵 Amount: *${Number(dep.amount).toFixed(2)} ETB*\n` +
      `🔖 Reference: ${dep.txnId || 'N/A'}\n` +
      `📅 Submitted: ${dep.createdAt.toLocaleString()}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_dep_${dep.id}`),
            Markup.button.callback('❌ Reject', `reject_dep_${dep.id}`),
          ],
        ]),
      }
    );
  }
}

export async function handleAdminWithdrawals(ctx: Context) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;

  const withdrawals = await getPendingWithdrawals();
  if (!withdrawals.length) {
    return ctx.reply('✅ No pending withdrawals.');
  }

  for (const wd of withdrawals.slice(0, 5)) {
    const userName = wd.user.telegramUsername ? `@${wd.user.telegramUsername}` : wd.user.firstName;
    await ctx.reply(
      `📤 *Withdrawal Request*\n\n` +
      `👤 User: ${userName}\n` +
      `💵 Amount: *${Number(wd.amount).toFixed(2)} ETB*\n` +
      `🏦 Bank: ${wd.bankName}\n` +
      `👤 Account: ${wd.accountName}\n` +
      `🔢 Account #: ${wd.accountNumber}\n` +
      `📅 Submitted: ${wd.createdAt.toLocaleString()}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_wd_${wd.id}`),
            Markup.button.callback('❌ Reject', `reject_wd_${wd.id}`),
          ],
        ]),
      }
    );
  }
}

export async function handleApproveDeposit(ctx: Context, depositId: string) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;
  try {
    await approveDeposit(depositId, staffId);
    await ctx.answerCbQuery('✅ Deposit approved!');
    await ctx.editMessageText(`✅ *Deposit Approved*\nID: \`${depositId}\``, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await ctx.answerCbQuery(`❌ ${e.message}`);
  }
}

export async function handleRejectDeposit(ctx: Context, depositId: string) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;
  try {
    await rejectDeposit(depositId, staffId, 'Rejected by staff');
    await ctx.answerCbQuery('❌ Deposit rejected');
    await ctx.editMessageText(`❌ *Deposit Rejected*\nID: \`${depositId}\``, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await ctx.answerCbQuery(`❌ ${e.message}`);
  }
}

export async function handleApproveWithdrawal(ctx: Context, withdrawalId: string) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;
  try {
    await approveWithdrawal(withdrawalId, staffId);
    await ctx.answerCbQuery('✅ Withdrawal approved!');
    await ctx.editMessageText(`✅ *Withdrawal Approved*\nID: \`${withdrawalId}\``, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await ctx.answerCbQuery(`❌ ${e.message}`);
  }
}

export async function handleRejectWithdrawal(ctx: Context, withdrawalId: string) {
  const staffId = await requireStaff(ctx);
  if (!staffId) return;
  try {
    await rejectWithdrawal(withdrawalId, staffId, 'Rejected by staff');
    await ctx.answerCbQuery('❌ Withdrawal rejected');
    await ctx.editMessageText(`❌ *Withdrawal Rejected*\nID: \`${withdrawalId}\``, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await ctx.answerCbQuery(`❌ ${e.message}`);
  }
}
