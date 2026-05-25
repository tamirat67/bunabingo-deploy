import axios from 'axios';
import { getTgInitData } from './telegram';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  try {
    // 1. Check for Telegram InitData
    const initData = getTgInitData();
    if (initData) {
      config.headers['x-telegram-init-data'] = initData;
    }

    // 2. Check for Web Auth Token (JWT)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (e) {
    console.warn('Interceptor error:', e);
  }
  return config;
}, (error) => Promise.reject(error));

export const getRooms = () => api.get('/rooms').then(res => res.data).catch(() => []);
export const getMe = () => api.get('/me').then(res => res.data).catch(() => null);
export const getProfile = () => api.get('/me/profile').then(res => res.data).catch(() => null);
export const getWallet = () => api.get('/wallet').then(res => res.data).catch(() => null);
export const verifyPhone = (contact: any) => api.post('/auth/verify-phone', { contact }).then(res => res.data);
export const joinGame = (roomType: string, cardIds: number[]) => api.post('/games/join', { roomType, cardIds }).then(res => res.data);
export const getGame = (id: string) => api.get(`/games/${id}`).then(res => res.data);
export const getMyCard = (id: string) => api.get(`/games/${id}/mycard`).then(res => res.data);
export const claimBingo = (gameId: string) => api.post(`/games/${gameId}/bingo`).then(res => res.data);
export const addTicket = (gameId: string, cardIds: number[]) => api.post(`/games/${gameId}/tickets`, { cardIds }).then(res => res.data);
export const getLeaderboard = (timeframe: string) => api.get(`/leaderboard?timeframe=${timeframe}`).then(res => res.data);
export const getHistory = () => api.get('/history').then(res => res.data);
export const getGlobalHistory = () => api.get('/history/global').then(res => res.data);
export const convertCoins = () => api.post('/me/coins/convert').then(res => res.data);
export const markJackpotSeen = () => api.post('/me/jackpot/seen').then(res => res.data);
export const getOccupiedCards = (roomType: string, gameId?: string) => 
  api.get(`/rooms/${roomType}/occupied${gameId ? `?gameId=${gameId}` : ''}`).then(res => res.data);
export const getAgentStats = () => api.get('/agent/stats').then(res => res.data).catch(() => null);
export const getDeposits = () => api.get('/deposits').then(res => res.data).catch(() => []);
export const getWithdrawals = () => api.get('/withdrawals').then(res => res.data).catch(() => []);
export const getTransactions = (page = 1) => api.get(`/transactions?page=${page}`).then(res => res.data).catch(() => []);

export default api;
