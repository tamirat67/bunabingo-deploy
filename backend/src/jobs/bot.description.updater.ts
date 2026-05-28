import { Telegraf } from 'telegraf';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Counts total real users and agents in the system.
 */
async function getUserAndAgentCounts(): Promise<{ users: number; agents: number }> {
  const [users, agents] = await Promise.all([
    prisma.user.count({ where: { isBot: false, role: 'PLAYER' } }),
    prisma.user.count({ where: { isBot: false, role: 'AGENT' } })
  ]);
  return { users, agents };
}

/**
 * Formats a number with comma separators: 17763 → "17,763"
 */
function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Updates the bot's Telegram description with the current total users and agents count.
 * Telegram shows this text in the bot's info panel, right under the bot name.
 */
export async function updateBotDescription(bot: Telegraf): Promise<void> {
  try {
    const { users, agents } = await getUserAndAgentCounts();
    const formattedUsers = formatCount(users);
    const formattedAgents = formatCount(agents);

    // Short description — shown under bot name in chat list / search results
    await bot.telegram.setMyShortDescription(`${formattedUsers} Users & ${formattedAgents} Agents`);

    // Full description — shown on the bot's profile page when opened
    await bot.telegram.setMyDescription(
      `☕ Buna Bingo — Ethiopia's #1 Telegram Bingo Game!\n\n` +
      `🎮 Play Bingo & Spin games and win real ETB prizes.\n` +
      `👥 ${formattedUsers} Users & ${formattedAgents} Agents\n\n` +
      `Tap START to join the fun!`
    );

    logger.info(`[BotDesc] Updated bot description: ${formattedUsers} Users & ${formattedAgents} Agents`);
  } catch (err) {
    logger.error('[BotDesc] Failed to update bot description:', err);
  }
}
