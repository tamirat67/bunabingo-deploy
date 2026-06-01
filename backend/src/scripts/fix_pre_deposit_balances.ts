/**
 * fix_pre_deposit_balances.ts
 *
 * One-time migration: recalculate every agent's AgentPreDepositWallet balance
 * by replaying their AgentCommissionLog — ignoring any WITHDRAWAL_REIMBURSE
 * entries that incorrectly inflated the balance under the old system.
 *
 * Correct formula:
 *   balance        = Σ RECHARGE − Σ COMMISSION_DEBIT
 *   totalRecharged = Σ RECHARGE  (manual admin top-ups only)
 *   totalDebited   = Σ COMMISSION_DEBIT (per-game company commissions only)
 *
 * Run on the server:
 *   docker compose exec backend npx ts-node src/scripts/fix_pre_deposit_balances.ts
 */

import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Agent Pre-Deposit Balance Fix — ALL Agents');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Get every agent
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT' },
    select: { id: true, firstName: true, telegramUsername: true },
  });

  if (agents.length === 0) {
    console.log('No agents found. Nothing to fix.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${agents.length} agent(s). Processing...\n`);

  let fixed = 0;
  let skipped = 0;

  for (const agent of agents) {
    const label = `${agent.firstName ?? 'Unknown'} (@${agent.telegramUsername ?? agent.id})`;

    // 2. Fetch or create wallet
    let wallet = await prisma.agentPreDepositWallet.findUnique({
      where: { agentId: agent.id },
    });

    if (!wallet) {
      wallet = await prisma.agentPreDepositWallet.create({
        data: { agentId: agent.id, balance: 10_000, totalRecharged: 10_000 },
      });
      console.log(`  [NEW]    ${label}`);
      console.log(`           → Created wallet, seeded with 10,000 ETB\n`);
      fixed++;
      continue;
    }

    // 3. Replay audit log — only RECHARGE and COMMISSION_DEBIT count
    //    WITHDRAWAL_REIMBURSE is intentionally excluded (was wrong old behavior)
    const logs = await prisma.agentCommissionLog.findMany({
      where: {
        agentId: agent.id,
        type: { in: ['RECHARGE', 'COMMISSION_DEBIT'] },
      },
      select: { type: true, amount: true },
    });

    let totalRecharged = new Decimal(0);
    let totalDebited   = new Decimal(0);

    for (const log of logs) {
      if (log.type === 'RECHARGE') {
        totalRecharged = totalRecharged.add(log.amount.toString());
      } else if (log.type === 'COMMISSION_DEBIT') {
        totalDebited = totalDebited.add(log.amount.toString());
      }
    }

    // If the agent has no log entries at all (brand-new or pre-log era),
    // treat the current totalRecharged field value as source of truth.
    // If that's also 0, seed to 10,000.
    if (logs.length === 0) {
      const walletRecharged = new Decimal(wallet.totalRecharged.toString());
      totalRecharged = walletRecharged.isZero()
        ? new Decimal(10_000)
        : walletRecharged;
      totalDebited = new Decimal(wallet.totalDebited.toString());
    }

    const correctBalance  = totalRecharged.sub(totalDebited);
    const currentBalance  = new Decimal(wallet.balance.toString());
    const currentRecharged = new Decimal(wallet.totalRecharged.toString());
    const currentDebited   = new Decimal(wallet.totalDebited.toString());

    const balanceDiff   = correctBalance.sub(currentBalance).abs().toNumber();
    const rechargedDiff = totalRecharged.sub(currentRecharged).abs().toNumber();
    const debitedDiff   = totalDebited.sub(currentDebited).abs().toNumber();

    if (balanceDiff < 0.01 && rechargedDiff < 0.01 && debitedDiff < 0.01) {
      console.log(`  [OK]     ${label}`);
      console.log(`           Balance: ${currentBalance.toFixed(2)} ETB (already correct)\n`);
      skipped++;
      continue;
    }

    // 4. Apply correction
    await prisma.agentPreDepositWallet.update({
      where: { agentId: agent.id },
      data: {
        balance:        correctBalance,
        totalRecharged: totalRecharged,
        totalDebited:   totalDebited,
        updatedAt:      new Date(),
      },
    });

    console.log(`  [FIXED]  ${label}`);
    console.log(`           Balance  : ${currentBalance.toFixed(2)} → ${correctBalance.toFixed(2)} ETB`);
    console.log(`           Recharged: ${currentRecharged.toFixed(2)} → ${totalRecharged.toFixed(2)} ETB`);
    console.log(`           Debited  : ${currentDebited.toFixed(2)} → ${totalDebited.toFixed(2)} ETB\n`);
    fixed++;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  DONE.  Fixed: ${fixed}  |  Already correct: ${skipped}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Script failed:', err.message);
  process.exit(1);
});
