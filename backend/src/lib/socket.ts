import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from './logger';

let io: SocketServer | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (userId) {
      socket.join(`user_${userId}`);
      logger.info(`[Socket] User ${userId} connected and joined private room.`);
    }

    socket.on('join-game', (gameId: string) => {
      socket.join(`game_${gameId}`);
      logger.info(`[Socket] Socket ${socket.id} joined game room: ${gameId}`);
    });

    socket.on('leave-game', (gameId: string) => {
      socket.leave(`game_${gameId}`);
      logger.info(`[Socket] Socket ${socket.id} left game room: ${gameId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
}

/**
 * Trigger an event for a specific user
 */
export function triggerSocketUserEvent(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

/**
 * Trigger an event for a specific game room
 */
export function triggerSocketGameEvent(gameId: string, event: string, data: any) {
  if (!io) return;
  io.to(`game_${gameId}`).emit(event, data);
}

/**
 * Global broadcast
 */
export function triggerSocketGlobalEvent(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
}
