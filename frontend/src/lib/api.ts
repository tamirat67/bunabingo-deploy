import axios from 'axios';
import { getTgInitData } from './telegram';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use(cfg => {
  const initData = getTgInitData();
  if (initData) cfg.headers['x-telegram-init-data'] = initData;
  return cfg;
});

// Auth
export const getMe = () => api.get('/me').then(r => r.data);
export const getProfile = () => api.get('/me/profile').then(r => r.data);
export const getWallet = () => api.get('/wallet').then(r => r.data);
export const getTransactions = (page = 1) => api.get(`/transactions?page=${page}`).then(r => r.data);

// Deposits
export const getDeposits = () => api.get('/deposits').then(r => r.data);
export const createDeposit = (data: FormData) =>
  api.post('/deposits', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);

// Withdrawals
export const getWithdrawals = () => api.get('/withdrawals').then(r => r.data);
export const createWithdrawal = (data: { amount: number; accountName: string; accountNumber: string; bankName: string }) =>
  api.post('/withdrawals', data).then(r => r.data);

// Rooms & Games
export const getRooms = () => api.get('/rooms').then(r => r.data);
export const joinGame = (roomType: string) => api.post('/games/join', { roomType }).then(r => r.data);
export const getGame = (gameId: string) => api.get(`/games/${gameId}`).then(r => r.data);
export const getMyCard = (gameId: string) => api.get(`/games/${gameId}/mycard`).then(r => r.data);
export const getMyTickets = () => api.get('/mytickets').then(r => r.data);
export const getHistory = () => api.get('/history').then(r => r.data);

// Pusher auth
export const pusherAuth = (socketId: string, channelName: string) =>
  api.post('/pusher/auth', { socket_id: socketId, channel_name: channelName }).then(r => r.data);

// Admin
export const adminAnalytics = () => api.get('/admin/analytics').then(r => r.data);
export const adminPendingDeposits = () => api.get('/admin/deposits/pending').then(r => r.data);
export const adminApproveDeposit = (id: string) => api.post(`/admin/deposits/${id}/approve`).then(r => r.data);
export const adminRejectDeposit = (id: string, reason: string) => api.post(`/admin/deposits/${id}/reject`, { reason }).then(r => r.data);
export const adminPendingWithdrawals = () => api.get('/admin/withdrawals/pending').then(r => r.data);
export const adminApproveWithdrawal = (id: string) => api.post(`/admin/withdrawals/${id}/approve`).then(r => r.data);
export const adminRejectWithdrawal = (id: string, reason: string) => api.post(`/admin/withdrawals/${id}/reject`, { reason }).then(r => r.data);
export const adminUsers = (page = 1) => api.get(`/admin/users?page=${page}`).then(r => r.data);
export const adminActiveGames = () => api.get('/admin/games/active').then(r => r.data);

export default api;
