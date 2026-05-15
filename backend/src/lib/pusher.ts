import Pusher from 'pusher';
import { config } from '../config';

export const pusher = new Pusher({
  appId: config.pusher.appId,
  key: config.pusher.key,
  secret: config.pusher.secret,
  cluster: config.pusher.cluster,
  useTLS: true,
});

import { 
  triggerSocketGameEvent, 
  triggerSocketUserEvent, 
  triggerSocketGlobalEvent 
} from './socket';

export const triggerGameEvent = async (gameId: string, event: string, data: unknown) => {
  try {
    // 1. Pusher (External)
    await pusher.trigger(`private-game-${gameId}`, event, data);
    // 2. Socket.io (Internal - VPS)
    triggerSocketGameEvent(gameId, event, data);
  } catch (err) {
    console.error('[EventBus] Failed to trigger game event:', err);
  }
};

export const triggerUserEvent = async (userId: string, event: string, data: unknown) => {
  try {
    // 1. Pusher
    await pusher.trigger(`private-user-${userId}`, event, data);
    // 2. Socket.io
    triggerSocketUserEvent(userId, event, data);
  } catch (err) {
    console.error('[EventBus] Failed to trigger user event:', err);
  }
};

export const triggerAdminEvent = async (event: string, data: unknown) => {
  try {
    // 1. Pusher
    await pusher.trigger('admin-channel', event, data);
    // 2. Socket.io
    triggerSocketGlobalEvent(event, data);
  } catch (err) {
    console.error('[EventBus] Failed to trigger admin event:', err);
  }
};
