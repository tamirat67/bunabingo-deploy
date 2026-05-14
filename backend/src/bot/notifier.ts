
import { bot } from '../index';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { Markup } from 'telegraf';

/**
 * Notifies an agent on Telegram about a new request from their referred player.
 * Now supports optional inline buttons for direct approval/rejection.
 */
export async function notifyAgent(agentId: string, message: string, buttons?: any) {
  try {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { telegramId: true }
    });

    if (!agent || !agent.telegramId) {
      logger.warn(`[Notifier] Could not find agent ${agentId} or their Telegram ID.`);
      return;
    }

    await bot.telegram.sendMessage(Number(agent.telegramId), message, { 
      parse_mode: 'HTML',
      ...(buttons ? buttons : {})
    });
    
    logger.info(`[Notifier] Sent Telegram notification to agent ${agentId}`);
  } catch (err) {
    logger.error(`[Notifier] Failed to notify agent ${agentId}:`, err);
  }
}
