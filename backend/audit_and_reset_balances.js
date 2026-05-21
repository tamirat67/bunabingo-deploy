/**
 * SAFE BALANCE AUDIT & RESET SCRIPT
 * ───────────────────────────────────────────────────────────────────
 * This script calculates each player's TRUE balance from the transaction
 * ledger and resets the wallet to match — removing any fake free 1000 ETB
 * that was added directly to the wallet without a transaction record.
 *
 * SAFE: Does NOT subtract a fixed 1000. Instead it computes:
 *   trueBalance = (DEPOSIT + PRIZE_WIN + REFUND + REFERRAL_COMMISSION + REFERRAL_BONUS)
 *               - (TICKET_PURCHASE + WITHDRAWAL)
 *
 * If wallet.balance > trueBalance → the difference is fake money → reset to trueBalance
 * If wallet.balance <= trueBalance → real money, do NOT touch
 * ───────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditAndResetBalances() {
  console.log('='.repeat(60));
  console.log('SAFE BALANCE AUDIT & RESET — Removing Free Test 1000 ETB');
  console.log('='.repeat(60));

  const wallets = await prisma.wallet.findMany();
  console.log(`\nFound ${wallets.length} wallets to audit.\n`);

  let correctedCount = 0;
  let skippedCount = 0;
  let alreadyCorrectCount = 0;

  for (const wallet of wallets) {
    const currentBalance = Number(wallet.balance);

    // Calculate true balance from transaction ledger
    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: wallet.userId,
        status: { in: ['completed', 'COMPLETED'] }
      },
      _sum: { amount: true }
    });

    const sums = {};
    txSums.forEach(group => {
      sums[group.type] = Number(group._sum.amount || 0);
    });

    const deposits     = sums['DEPOSIT'] || 0;
    const wins        = sums['PRIZE_WIN'] || 0;
    const refunds     = sums['REFUND'] || 0;
    const commissions = sums['REFERRAL_COMMISSION'] || 0;
    const bonuses     = sums['REFERRAL_BONUS'] || 0;
    const spent       = sums['TICKET_PURCHASE'] || 0;
    const withdrawn   = sums['WITHDRAWAL'] || 0;

    const trueBalance = Math.max(
      0,
      (deposits + wins + refunds + commissions + bonuses) - (spent + withdrawn)
    );

    const diff = currentBalance - trueBalance;

    if (diff > 0.005) {
      // Wallet has MORE than ledger says → fake money present
      console.log(
        `[FIX]  userId=${wallet.userId} | ` +
        `wallet=${currentBalance.toFixed(2)} | ` +
        `trueBalance=${trueBalance.toFixed(2)} | ` +
        `removing=${diff.toFixed(2)} ETB`
      );

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: trueBalance }
      });

      correctedCount++;
    } else if (diff < -0.005) {
      // Wallet has LESS than ledger — possible inconsistency, log but don't touch
      console.log(
        `[WARN] userId=${wallet.userId} | ` +
        `wallet=${currentBalance.toFixed(2)} | ` +
        `trueBalance=${trueBalance.toFixed(2)} | ` +
        `wallet is LOWER than ledger (possible pending tx) — SKIPPING`
      );
      skippedCount++;
    } else {
      // Balance matches ledger — already correct
      alreadyCorrectCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log(`  ✅ Corrected (fake money removed): ${correctedCount}`);
  console.log(`  ⚠️  Skipped (wallet lower than ledger): ${skippedCount}`);
  console.log(`  ✓  Already correct: ${alreadyCorrectCount}`);
  console.log('='.repeat(60));
}

auditAndResetBalances()
  .catch(e => {
    console.error('FATAL ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => process.exit(0)));
