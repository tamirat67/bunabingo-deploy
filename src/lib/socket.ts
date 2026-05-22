import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

let socket: Socket | null = null;

export const getSocket = (userId?: string) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      query: userId ? { userId } : {},
      transports: ['websocket'],       // websocket only — fastest, no polling upgrade delay
      reconnection: true,
      reconnectionAttempts: Infinity,  // always try to reconnect
      reconnectionDelay: 500,          // retry fast (was 1000ms)
      reconnectionDelayMax: 3000,
      timeout: 8000,
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
