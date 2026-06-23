/**
 * grant_welcome_bonus_all.ts
 *
 * One-time backfill: grants the 100 ETB welcome bonus to ALL existing real players
 * who have not already received it.
 *
 * Safety rules:
 *  - Skips bots  (isBot = true)
 *  - Skips ADMIN and AGENT role users
 *  - Skips anyone who already has a WELCOME_BONUS transaction (idempotent)
 *  - Uses an atomic DB transaction per user (wallet update + transaction log)
 *  - Dry-run mode by default — set DRY_RUN=false to actually apply changes
 *
 * Usage:
 *   npx ts-node grant_welcome_bonus_all.ts          ← dry-run (preview only)
 *   DRY_RUN=false npx ts-node grant_welcome_bonus_all.ts  ← apply for real
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Telegraf } from 'telegraf';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN || '');

const WELCOME_BONUS_ETB = 100;
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry-run

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WELCOME BONUS BACKFILL — 100 ETB for all real players');
  console.log(`  MODE: ${DRY_RUN ? '🔍 DRY RUN (no changes will be written)' : '✅ LIVE — changes WILL be committed'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Fetch all real player-role users ────────────────────────────────────
  const allPlayers = await prisma.user.findMany({
    where: {
      isBot: false,
      role:  'PLAYER',
    },
    select: {
      id:        true,
      firstName: true,
      telegramUsername: true,
      telegramId: true,
      wallet: { select: { bonusBalance: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${allPlayers.length} real PLAYER accounts to check.\n`);

  let grantedCount  = 0;
  let skippedCount  = 0;
  let errorCount    = 0;

  for (const player of allPlayers) {
    const label = player.telegramUsername
      ? `@${player.telegramUsername}`
      : (player.firstName || player.id.slice(0, 8));

    // ── 2. Idempotency: skip if already granted ─────────────────────────────
    const alreadyGranted = await prisma.transaction.findFirst({
      where: { userId: player.id, type: 'WELCOME_BONUS' },
    });

    if (alreadyGranted) {
      console.log(`  [SKIP] ${label} — already has WELCOME_BONUS`);
      skippedCount++;
      continue;
    }

    // ── 3. Compute new balance ───────────────────────────────────────────────
    const currentBonus  = new Decimal(player.wallet?.bonusBalance?.toString() || '0');
    const bonusAmt      = new Decimal(WELCOME_BONUS_ETB);
    const newBonus      = currentBonus.add(bonusAmt);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would grant ${WELCOME_BONUS_ETB} ETB to ${label} (bonusBalance: ${currentBonus} → ${newBonus})`);
      grantedCount++;
      continue;
    }

    // ── 4. Apply atomically ──────────────────────────────────────────────────
    try {
      await prisma.$transaction(async (tx) => {
        // Ensure wallet exists (upsert is safe)
        await tx.wallet.upsert({
          where:  { userId: player.id },
          create: { userId: player.id, balance: 0, bonusBalance: bonusAmt },
          update: { bonusBalance: newBonus },
        });

        // Create transaction log for audit trail
        await tx.transaction.create({
          data: {
            userId:        player.id,
            type:          'WELCOME_BONUS',
            amount:        bonusAmt,
            balanceBefore: currentBonus,
            balanceAfter:  newBonus,
            status:        'completed',
            description:   'Welcome bonus backfill — 100 ETB promotional grant (playable, non-withdrawable)',
          },
        });
      });

      console.log(`  [GRANTED] ${label} — +${WELCOME_BONUS_ETB} ETB bonus (bonusBalance: ${currentBonus} → ${newBonus})`);
      grantedCount++;

      // ── Notify the user via Telegram ─────────────────────────────────────────
      try {
        await bot.telegram.sendMessage(
          Number(player.telegramId),
          `🎉 <b>እንኳን ደስ አለዎ!</b>\n\n` +
          `☕️ ከ <b>ቡና ቢንጎ</b> ጋር ስለሆኑ እናመሰግናለን!\n\n` +
          `🎁 <b>+100.00 ብር (ETB) ልዩ ቦነስ</b> ወደ ሂሳብዎ ገቢ ተደርጓል!\n\n` +
          `🎮 አሁኑኑ ቦነሱን በመጠቀም ጨዋታዎችን ይጫወቱ።`,
          { parse_mode: 'HTML' }
        );
        console.log(`  [NOTIFIED] Sent Telegram message to ${label}`);
      } catch (notifyErr: any) {
        console.log(`  [WARN]     Could not notify ${label} on Telegram: ${notifyErr.message}`);
      }

    } catch (err: any) {
      console.error(`  [ERROR]   ${label} — ${err.message}`);
      errorCount++;
    }
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  DONE`);
  console.log(`  ✅ ${DRY_RUN ? 'Would grant' : 'Granted'}:  ${grantedCount} players`);
  console.log(`  ⏭️  Skipped: ${skippedCount} players (already had bonus)`);
  if (errorCount > 0) {
    console.log(`  ❌ Errors:  ${errorCount} players`);
  }
  if (DRY_RUN) {
    console.log('\n  ⚠️  This was a DRY RUN. To apply for real:');
    console.log('     DRY_RUN=false npx ts-node grant_welcome_bonus_all.ts');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('FATAL:', err);
  prisma.$disconnect();
  process.exit(1);
});
