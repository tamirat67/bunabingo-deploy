import { Telegraf } from 'telegraf';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Counts users who purchased at least one ticket in the last 30 days.
 * These are "monthly active players" — real bingo game participants.
 */
async function getMonthlyActiveUsers(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await prisma.ticket.groupBy({
    by: ['userId'],
    where: {
      purchasedAt: { gte: thirtyDaysAgo },
    },
  });

  return result.length;
}

/**
 * Formats a number with comma separators: 17763 → "17,763"
 */
function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Updates the bot's Telegram description with the current monthly active user count.
 * Telegram shows this text in the bot's info panel, right under the bot name.
 */
export async function updateBotDescription(bot: Telegraf): Promise<void> {
  try {
    const count = await getMonthlyActiveUsers();
    const formatted = formatCount(count);

    // Short description — shown under bot name in chat list / search results
    await bot.telegram.setMyShortDescription(`${formatted} monthly players`);

    // Full description — shown on the bot's profile page when opened
    await bot.telegram.setMyDescription(
      `☕ Buna Bingo — Ethiopia's #1 Telegram Bingo Game!\n\n` +
      `🎮 Play Bingo & Spin games and win real ETB prizes.\n` +
      `👥 ${formatted} players active this month.\n\n` +
      `Tap START to join the fun!`
    );

    logger.info(`[BotDesc] Updated bot description: ${formatted} monthly active users`);
  } catch (err) {
    logger.error('[BotDesc] Failed to update bot description:', err);
  }
}
