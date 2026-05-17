'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socket';
import api from '../lib/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let s: Socket | null = null;

    const init = async () => {
      try {
        // 1. Try to get Telegram user ID instantly from WebApp SDK for immediate connection
        let userId = '';
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) {
          userId = String((window as any).Telegram.WebApp.initDataUnsafe.user.id);
        }
        
        // 2. Fallback to /me API only if not running inside Telegram
        if (!userId) {
          const res = await api.get('/me');
          userId = res.data?.id;
        }

        if (userId) {
          s = getSocket(userId);
          setSocket(s);

          s.on('connect', () => setIsConnected(true));
          s.on('disconnect', () => setIsConnected(false));
        }
      } catch (err) {
        console.error('Socket init failed:', err);
      }
    };

    init();

    return () => {
      if (s) disconnectSocket();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
