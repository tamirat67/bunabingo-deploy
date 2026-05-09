import Pusher from 'pusher';
import { config } from '../config';

export const pusher = new Pusher({
  appId: config.pusher.appId,
  key: config.pusher.key,
  secret: config.pusher.secret,
  cluster: config.pusher.cluster,
  useTLS: true,
});

export const triggerGameEvent = async (gameId: string, event: string, data: unknown) => {
  try {
    await pusher.trigger(`game-${gameId}`, event, data);
  } catch (err) {
    console.error('[Pusher] Failed to trigger event:', err);
  }
};

export const triggerUserEvent = async (userId: string, event: string, data: unknown) => {
  try {
    await pusher.trigger(`user-${userId}`, event, data);
  } catch (err) {
    console.error('[Pusher] Failed to trigger user event:', err);
  }
};

export const triggerAdminEvent = async (event: string, data: unknown) => {
  try {
    await pusher.trigger('admin-channel', event, data);
  } catch (err) {
    console.error('[Pusher] Failed to trigger admin event:', err);
  }
};
