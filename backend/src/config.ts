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
    // ── Revenue Split ────────────────────────────────────────────────────────
    // companyCommissionRate: 30% of real player sales per game → deducted from Agent Pre-Deposit
    //   (covers 20% company revenue + 10% agent profit guarantee)
    // agentProfitRate:       10% of TOTAL SALES → agent keeps as profit (display only)
    // playerPrizeRate:       70% of TOTAL SALES → paid out as prize pool
    companyCommissionRate: parseFloat(process.env.COMPANY_COMMISSION_RATE || '30') / 100,  // 0.30
    agentProfitRate:       parseFloat(process.env.AGENT_PROFIT_RATE || '10') / 100,        // 0.10
    playerPrizeRate:       parseFloat(process.env.PLAYER_PRIZE_RATE || '70') / 100,        // 0.70
    commissionRate: 0.30,
    countdown: {
      default: 50,
      DEMO: 50,
      CASUAL: 50,
      STANDARD: 50,
      PRO: 50,
      JACKPOT: 50,
      VIP: 50,
    } as Record<string, number>,
    drawIntervalMs: 3000,         // 3.0 seconds between draws
    minBallsBeforeWin: 35,        // at least 35 balls must be drawn before any win is valid (~105 seconds minimum game)
    houseEdgePercent: parseFloat(process.env.HOUSE_EDGE_PERCENT || '30'),
    totalNumbers: 75,             // standard bingo 1-75
  },
  withdrawal: {
    minAmount: parseFloat(process.env.MIN_WITHDRAWAL || '200'),
    maxAmount: parseFloat(process.env.MAX_WITHDRAWAL || '10000'),
  },
  payment: {
    receiverName:  process.env.PAYMENT_RECEIVER_NAME   || 'Luel G/libanos',
    receiverPhone: process.env.PAYMENT_RECEIVER_PHONE  || '+251969455111',
    telebirrPhone: process.env.PAYMENT_TELEBIRR_PHONE  || '+251969455111',
    supportAgent1: process.env.PAYMENT_SUPPORT_AGENT1  || '@Luel1616',
    supportAgent2: process.env.PAYMENT_SUPPORT_AGENT2  || '@Luel1616',
    bunaEngineHost: process.env.BUNA_ENGINE_HOST || 'http://rexhetmfgnf.aabte.com.et',
    bunaEngineKey:  process.env.BUNA_ENGINE_KEY  || '',
  },
};
