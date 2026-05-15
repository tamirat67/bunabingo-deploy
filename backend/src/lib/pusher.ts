import { 
  triggerSocketGameEvent, 
  triggerSocketUserEvent, 
  triggerSocketGlobalEvent 
} from './socket';
import { logger } from './logger';

/**
 * High-Performance Event Bus (VPS Optimized)
 * Replaces Pusher with local Socket.io for unlimited concurrent players.
 */

export const triggerGameEvent = async (gameId: string, event: string, data: unknown) => {
  try {
    // VPS Socket.io (Internal - High Performance)
    triggerSocketGameEvent(gameId, event, data);
  } catch (err) {
    logger.error(`[EventBus] Failed to trigger game event: ${event}`, err);
  }
};

export const triggerUserEvent = async (userId: string, event: string, data: unknown) => {
  try {
    // VPS Socket.io (Internal)
    triggerSocketUserEvent(userId, event, data);
  } catch (err) {
    logger.error(`[EventBus] Failed to trigger user event: ${event}`, err);
  }
};

export const triggerAdminEvent = async (event: string, data: unknown) => {
  try {
    // VPS Socket.io (Internal)
    triggerSocketGlobalEvent(event, data);
  } catch (err) {
    logger.error(`[EventBus] Failed to trigger admin event: ${event}`, err);
  }
};
