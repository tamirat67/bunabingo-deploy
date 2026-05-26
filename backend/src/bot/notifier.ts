
import { bot } from '../index';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { Markup } from 'telegraf';
import { config } from '../config';

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

/**
 * Notifies a specific user on Telegram.
 */
export async function notifyUser(userId: string, message: string, buttons?: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true }
    });

    if (!user || !user.telegramId) {
      logger.warn(`[Notifier] Could not find user ${userId} or their Telegram ID.`);
      return;
    }

    await bot.telegram.sendMessage(Number(user.telegramId), message, {
      parse_mode: 'HTML',
      ...(buttons ? buttons : {})
    });

    logger.info(`[Notifier] Sent Telegram notification to user ${userId}`);
  } catch (err) {
    logger.error(`[Notifier] Failed to notify user ${userId}:`, err);
  }
}

export async function broadcastMessage(message: string, imageUrl?: string | null, buttons?: any): Promise<{ successCount: number; failureCount: number }> {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, telegramId: true }
    });

    let successCount = 0;
    let failureCount = 0;

    logger.info(`[Notifier] Starting broadcast to ${users.length} users...`);

    const path = require('path');
    const fs = require('fs');

    // Post to the Telegram Channel @buna_bingobot1
    const targetChannels = ['@buna_bingobot1'];
    
    // Add default button linking to the bot if none provided
    const defaultButtons = Markup.inlineKeyboard([
      Markup.button.url('Play Buna Bingo 🎮', 'https://t.me/buna_bingobot')
    ]);
    const finalButtons = buttons ? buttons : defaultButtons;
    
    for (const channelUsername of targetChannels) {
      try {
        logger.info(`[Notifier] Broadcasting announcement to Telegram channel ${channelUsername}...`);
        if (imageUrl) {
          let photoInput: any = imageUrl;
          if (imageUrl.startsWith('/uploads/')) {
            const dockerPath = path.join(process.cwd(), imageUrl);
            const devPath = path.join(process.cwd(), 'backend', imageUrl);
            const compiledPath = path.join(__dirname, '../..', imageUrl);
            
            if (fs.existsSync(dockerPath)) {
              photoInput = { source: dockerPath };
            } else if (fs.existsSync(devPath)) {
              photoInput = { source: devPath };
            } else if (fs.existsSync(compiledPath)) {
              photoInput = { source: compiledPath };
            }
          }
          await bot.telegram.sendPhoto(channelUsername, photoInput, {
            caption: message,
            parse_mode: 'HTML',
            ...finalButtons
          });
        } else {
          await bot.telegram.sendMessage(channelUsername, message, {
            parse_mode: 'HTML',
            ...finalButtons
          });
        }
        logger.info(`[Notifier] Successfully posted announcement to Telegram channel ${channelUsername}`);
      } catch (channelErr) {
        logger.error(`[Notifier] Failed to post announcement to Telegram channel ${channelUsername}:`, channelErr);
      }
    }

    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        if (imageUrl) {
          let photoInput: any = imageUrl;
          if (imageUrl.startsWith('/uploads/')) {
            const dockerPath = path.join(process.cwd(), imageUrl);
            const devPath = path.join(process.cwd(), 'backend', imageUrl);
            const compiledPath = path.join(__dirname, '../..', imageUrl);
            
            if (fs.existsSync(dockerPath)) {
              photoInput = { source: dockerPath };
            } else if (fs.existsSync(devPath)) {
              photoInput = { source: devPath };
            } else if (fs.existsSync(compiledPath)) {
              photoInput = { source: compiledPath };
            }
          }
          await bot.telegram.sendPhoto(Number(user.telegramId), photoInput, {
            caption: message,
            parse_mode: 'HTML',
            ...finalButtons
          });
        } else {
          await bot.telegram.sendMessage(Number(user.telegramId), message, {
            parse_mode: 'HTML',
            ...finalButtons
          });
        }
        successCount++;
        // Small delay to prevent rate-limiting issues from Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        logger.error(`[Notifier] Broadcast failed for user ${user.id}:`, err);
        failureCount++;
      }
    }

    logger.info(`[Notifier] Broadcast finished. Success: ${successCount}, Failures: ${failureCount}`);
    return { successCount, failureCount };
  } catch (err) {
    logger.error(`[Notifier] Failed to execute broadcast:`, err);
    throw err;
  }
}

/**
 * Notifies the super-admin (@Luel1616) on Telegram about a withdrawal request.
 * Looks up the user by username 'Luel1616' in the DB to get their telegramId.
 * Falls back to sending by username string if not found.
 */
export async function notifySuperAdmin(message: string, buttons?: any): Promise<void> {
  const SUPER_ADMIN_USERNAME = 'Luel1616';

  try {
    // Try to find Luel1616 in the DB (registered admin/agent)
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: SUPER_ADMIN_USERNAME },
          { username: `@${SUPER_ADMIN_USERNAME}` },
        ]
      },
      select: { telegramId: true, id: true }
    });

    if (adminUser?.telegramId) {
      // Send via numeric telegramId (most reliable)
      await bot.telegram.sendMessage(Number(adminUser.telegramId), message, {
        parse_mode: 'HTML',
        ...(buttons ? buttons : {})
      });
      logger.info(`[Notifier] Sent withdrawal approval request to super-admin @${SUPER_ADMIN_USERNAME} (DB user).`);
    } else {
      // Fallback: send directly by Telegram username string
      // This works only if the user has previously messaged the bot
      await bot.telegram.sendMessage(`@${SUPER_ADMIN_USERNAME}`, message, {
        parse_mode: 'HTML',
        ...(buttons ? buttons : {})
      });
      logger.info(`[Notifier] Sent withdrawal approval request to @${SUPER_ADMIN_USERNAME} (by username).`);
    }
  } catch (err) {
    logger.error(`[Notifier] Failed to notify super-admin @${SUPER_ADMIN_USERNAME}:`, err);
  }
}
