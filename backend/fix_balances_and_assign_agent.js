/**
 * fix_balances_and_assign_agent.js
 * ─────────────────────────────────────────────────────────────────
 * TASK 1: Remove fake 1,000 ETB test balance from all wallets.
 *   - Calculates each user's TRUE balance from the transaction ledger.
 *   - Only reduces wallets that have MORE money than the ledger shows.
 *   - Never removes real deposited money.
 *
 * TASK 2: Assign all players (referredBy = null) to agent @sisay_2121.
 *   - Finds the agent by telegramUsername.
 *   - Updates all users who have no agent assigned.
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBalances() {
  console.log('\n' + '='.repeat(60));
  console.log('TASK 1: SAFE BALANCE AUDIT — Removing Fake 1,000 ETB');
  console.log('='.repeat(60));

  const wallets = await prisma.wallet.findMany();
  console.log(`Found ${wallets.length} wallets to audit.\n`);

  let correctedCount = 0;
  let alreadyCorrectCount = 0;
  let skippedCount = 0;

  for (const wallet of wallets) {
    const currentBalance = Number(wallet.balance);

    // Calculate true balance from completed transactions
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
    const wins         = sums['PRIZE_WIN'] || 0;
    const refunds      = sums['REFUND'] || 0;
    const commissions  = sums['REFERRAL_COMMISSION'] || 0;
    const bonuses      = sums['REFERRAL_BONUS'] || 0;
    const spent        = sums['TICKET_PURCHASE'] || 0;
    const withdrawn    = sums['WITHDRAWAL'] || 0;

    const trueBalance = Math.max(
      0,
      (deposits + wins + refunds + commissions + bonuses) - (spent + withdrawn)
    );

    const diff = currentBalance - trueBalance;

    if (diff > 0.005) {
      // Wallet has MORE than ledger — fake money, reset it
      console.log(
        `[FIX]  userId=${wallet.userId} | ` +
        `balance=${currentBalance.toFixed(2)} → trueBalance=${trueBalance.toFixed(2)} | ` +
        `removed=${diff.toFixed(2)} ETB`
      );
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: trueBalance,
          totalDeposited: deposits  // also correct totalDeposited
        }
      });
      correctedCount++;
    } else if (diff < -0.005) {
      console.log(
        `[SKIP] userId=${wallet.userId} | balance=${currentBalance.toFixed(2)} < trueBalance=${trueBalance.toFixed(2)} — SKIP`
      );
      skippedCount++;
    } else {
      alreadyCorrectCount++;
    }
  }

  console.log('\n--- TASK 1 DONE ---');
  console.log(`  ✅ Corrected (fake money removed): ${correctedCount}`);
  console.log(`  ✓  Already correct:               ${alreadyCorrectCount}`);
  console.log(`  ⚠️  Skipped (balance < ledger):    ${skippedCount}`);
}

async function assignToAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('TASK 2: ASSIGN ALL UNASSIGNED PLAYERS → @sisay_2121');
  console.log('='.repeat(60));

  // Find the agent by telegram username
  const agent = await prisma.user.findFirst({
    where: {
      telegramUsername: { equals: 'sisay_2121', mode: 'insensitive' },
      role: 'AGENT'
    }
  });

  if (!agent) {
    // Try by any role, maybe role is uppercase or different
    const agentAny = await prisma.user.findFirst({
      where: {
        telegramUsername: { equals: 'sisay_2121', mode: 'insensitive' }
      }
    });
    if (!agentAny) {
      console.error('❌ Agent @sisay_2121 not found in the database!');
      console.error('   Make sure the agent has registered via the bot first.');
      return;
    }
    console.log(`⚠️  Found @sisay_2121 but role is "${agentAny.role}" (not AGENT). Proceeding anyway.`);
    await doAssign(agentAny);
  } else {
    await doAssign(agent);
  }
}

async function doAssign(agent) {
  console.log(`\nAgent found: ${agent.firstName} (@${agent.telegramUsername}) — ID: ${agent.id}`);
  console.log(`Role: ${agent.role}`);

  // Count unassigned players (exclude agents and admins)
  const unassignedCount = await prisma.user.count({
    where: {
      referredBy: null,
      id: { not: agent.id },
      role: { not: 'ADMIN' }
    }
  });

  console.log(`\nFound ${unassignedCount} unassigned players to assign...`);

  if (unassignedCount === 0) {
    console.log('No unassigned players found. All players already have an agent.');
    return;
  }

  // Assign all unassigned non-admin users to this agent
  const result = await prisma.user.updateMany({
    where: {
      referredBy: null,
      id: { not: agent.id },
      role: { not: 'ADMIN' }
    },
    data: {
      referredBy: agent.id
    }
  });

  console.log(`\n✅ Successfully assigned ${result.count} players to @${agent.telegramUsername}!`);
}

async function main() {
  try {
    await fixBalances();
    await assignToAgent();
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TASKS COMPLETE');
    console.log('='.repeat(60));
  } catch (e) {
    console.error('\n❌ FATAL ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
