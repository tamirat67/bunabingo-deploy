import axios from 'axios';
import { getTgInitData } from './telegram';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bunabingo.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const initData = getTgInitData();
  if (initData) {
    config.headers['x-telegram-init-data'] = initData;
  }
  return config;
});

export const getRooms = () => api.get('/rooms').then(res => res.data);
export const getMe = () => api.get('/me').then(res => res.data);
export const getWallet = () => api.get('/wallet').then(res => res.data);
export const joinGame = (roomType: string, cardIds: number[]) => api.post('/games/join', { roomType, cardIds }).then(res => res.data);
export const getGame = (id: string) => api.get(`/games/${id}`).then(res => res.data);
export const getMyCard = (id: string) => api.get(`/games/${id}/mycard`).then(res => res.data);
export const pusherAuth = (socketId: string, channelName: string) => api.post('/pusher/auth', { socket_id: socketId, channel_name: channelName }).then(res => res.data);
export const claimBingo = (gameId: string) => api.post(`/games/${gameId}/bingo`).then(res => res.data);
export const addTicket = (gameId: string, cardIds: number[]) => api.post(`/games/${gameId}/tickets`, { cardIds }).then(res => res.data);
export const getLeaderboard = (timeframe: string) => api.get(`/leaderboard?timeframe=${timeframe}`).then(res => res.data);
export const getHistory = () => api.get('/history').then(res => res.data);

export default api;
