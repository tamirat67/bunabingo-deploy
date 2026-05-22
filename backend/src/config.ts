import dotenv from 'dotenv';
dotenv.config();

export const config = {
  bot: {
    token: process.env.BOT_TOKEN!,
    adminIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    miniAppUrl: (process.env.MINI_APP_URL?.startsWith('http') 
      ? process.env.MINI_APP_URL.replace(/\/$/, '')
      : `https://${process.env.MINI_APP_URL}`.replace(/\/$/, '')) || 'https://bunabingo.vercel.app',
  },
  server: {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_prod',
  },
  game: {
    ticketPrice: {
      DEMO: 0,
      CASUAL: parseFloat(process.env.TICKET_PRICE_CASUAL || '10'),
      STANDARD: parseFloat(process.env.TICKET_PRICE_STANDARD || '20'),
      PRO: parseFloat(process.env.TICKET_PRICE_PRO || '50'),
      JACKPOT: parseFloat(process.env.TICKET_PRICE_JACKPOT || '100'),
      VIP: parseFloat(process.env.TICKET_PRICE_VIP || '200'),
    },
    minPlayers: {
      DEMO: 1,
      CASUAL: 2,
      STANDARD: 2,
      PRO: 2,
      JACKPOT: 2,
      VIP: 2,
    },
    // ── Revenue Split (total house margin = 25%) ─────────────────────────────
    // companyCommissionRate: 12.5% of TOTAL SALES → deducted from Agent Pre-Deposit Wallet
    // agentProfitRate:      12.5% of TOTAL SALES → stays with the agent (house margin minus company cut)
    // playerPrizeRate:      75%   of TOTAL SALES → paid out as prize pool
    companyCommissionRate: parseFloat(process.env.COMPANY_COMMISSION_RATE || '12.5') / 100, // 0.125
    agentProfitRate:       parseFloat(process.env.AGENT_PROFIT_RATE || '12.5') / 100,       // 0.125
    playerPrizeRate:       parseFloat(process.env.PLAYER_PRIZE_RATE || '75') / 100,          // 0.75
    // Legacy alias — equals companyCommissionRate + agentProfitRate = 25% total
    commissionRate: 0.25,
    countdown: {
      default: 0,
      DEMO: 0,
      CASUAL: 0,
      STANDARD: 0,
      PRO: 0,
      JACKPOT: 0,
      VIP: 0,   // start instantly like all other rooms
    } as Record<string, number>,
    drawIntervalMs: 3000,         // 3 seconds between draws
    houseEdgePercent: parseFloat(process.env.HOUSE_EDGE_PERCENT || '25'),
    totalNumbers: 75,             // standard bingo 1-75
  },
  withdrawal: {
    minAmount: parseFloat(process.env.MIN_WITHDRAWAL || '200'),
    maxAmount: parseFloat(process.env.MAX_WITHDRAWAL || '10000'),
  },
  payment: {
    receiverName:  process.env.PAYMENT_RECEIVER_NAME   || 'Tame',
    receiverPhone: process.env.PAYMENT_RECEIVER_PHONE  || '251966129707',
    telebirrPhone: process.env.PAYMENT_TELEBIRR_PHONE  || '0997688294',
    supportAgent1: process.env.PAYMENT_SUPPORT_AGENT1  || '@sisay_2121',
    supportAgent2: process.env.PAYMENT_SUPPORT_AGENT2  || '@sisay_2121',
    bunaEngineHost: process.env.BUNA_ENGINE_HOST || 'http://rexhetmfgnf.aabte.com.et',
    bunaEngineKey:  process.env.BUNA_ENGINE_KEY  || '',
  },
};
