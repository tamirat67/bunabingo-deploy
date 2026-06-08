
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

export async function broadcastMessage(
  message: string,
  imageUrl?: string | null,
  buttons?: any,
  readMoreUrl?: string
): Promise<{ successCount: number; failureCount: number }> {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, telegramId: true }
    });

    let successCount = 0;
    let failureCount = 0;

    logger.info(`[Notifier] Starting broadcast to ${users.length} users...`);

    const path = require('path');
    const fs = require('fs');

    // Truncate very long messages and add a Read More button
    const MAX_CHARS = 500;
    let displayMessage = message;
    let hasMore = false;
    if (message.length > MAX_CHARS) {
      displayMessage = message.substring(0, MAX_CHARS).trimEnd() + '...';
      hasMore = true;
    }

    // Build buttons: always show Play button; add Read More if truncated
    const buttonRows: any[] = [];
    if (hasMore && readMoreUrl) {
      buttonRows.push([Markup.button.url('📖 Read Full Announcement', readMoreUrl)]);
    }
    buttonRows.push([Markup.button.url('Play Buna Bingo 🎮', 'https://t.me/buna_bingobot')]);
    const finalButtons = buttons ? buttons : Markup.inlineKeyboard(buttonRows);

    // Post to the Telegram Channel @buna_bingobot1 (the public announcement channel)
    const targetChannels = ['@buna_bingobot1'];
    
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
          if (displayMessage.length > 900) {
            // Send photo separately, then send text
            await bot.telegram.sendPhoto(channelUsername, photoInput);
            await bot.telegram.sendMessage(channelUsername, displayMessage, {
              parse_mode: 'HTML',
              ...finalButtons
            });
          } else {
            // Send together
            await bot.telegram.sendPhoto(channelUsername, photoInput, {
              caption: displayMessage,
              parse_mode: 'HTML',
              ...finalButtons
            });
          }
        } else {
          await bot.telegram.sendMessage(channelUsername, displayMessage, {
            parse_mode: 'HTML',
            ...finalButtons
          });
        }
        logger.info(`[Notifier] Successfully posted announcement to Telegram channel ${channelUsername}`);
      } catch (channelErr: any) {
        logger.error(`[Notifier] Failed to post announcement to Telegram channel ${channelUsername}: ${channelErr.message || channelErr}`);
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
          if (displayMessage.length > 900) {
            // Send photo separately, then send text
            await bot.telegram.sendPhoto(Number(user.telegramId), photoInput);
            await bot.telegram.sendMessage(Number(user.telegramId), displayMessage, {
              parse_mode: 'HTML',
              ...finalButtons
            });
          } else {
            // Send together
            await bot.telegram.sendPhoto(Number(user.telegramId), photoInput, {
              caption: displayMessage,
              parse_mode: 'HTML',
              ...finalButtons
            });
          }
        } else {
          await bot.telegram.sendMessage(Number(user.telegramId), displayMessage, {
            parse_mode: 'HTML',
            ...finalButtons
          });
        }
        successCount++;
        // Small delay to prevent rate-limiting issues from Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err: any) {
        logger.error(`[Notifier] Broadcast failed for user ${user.id} (telegramId: ${user.telegramId}): ${err.message || err}`);
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
 * Notifies the super-admin AND all ADMIN-role users in the DB on Telegram.
 * Used for deposit and withdrawal request alerts with optional approve/reject buttons.
 */
export async function notifySuperAdmin(message: string, buttons?: any): Promise<void> {
  const SUPER_ADMIN_TELEGRAM_ID = 5310030963; // @tanga_dreams — hardcoded primary

  // Collect all unique Telegram IDs to notify: hardcoded super-admin + all DB admins
  const notifyIds = new Set<number>([SUPER_ADMIN_TELEGRAM_ID]);

  try {
    const adminUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'admin'] }, telegramId: { not: null } },
      select: { telegramId: true }
    });
    for (const u of adminUsers) {
      if (u.telegramId) notifyIds.add(Number(u.telegramId));
    }
  } catch (err) {
    logger.warn('[Notifier] Could not fetch admin users from DB for notification.', err);
  }

  for (const chatId of notifyIds) {
    try {
      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        ...(buttons ? buttons : {})
      });
      logger.info(`[Notifier] Sent admin notification to Telegram ID ${chatId}.`);
    } catch (err) {
      logger.warn(`[Notifier] Failed to notify admin Telegram ID ${chatId}:`, err);
    }
  }
}
