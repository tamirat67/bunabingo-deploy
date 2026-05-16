import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

let socket: Socket | null = null;

export const getSocket = (userId?: string) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      query: userId ? { userId } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
