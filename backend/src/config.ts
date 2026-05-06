import dotenv from 'dotenv';
dotenv.config();

export const config = {
  bot: {
    token: process.env.BOT_TOKEN!,
    adminIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    miniAppUrl: (process.env.MINI_APP_URL?.startsWith('http') 
      ? process.env.MINI_APP_URL 
      : `https://${process.env.MINI_APP_URL}`) || 'https://bunabingo.vercel.app',
  },
  server: {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_prod',
  },
  pusher: {
    appId:   process.env.PUSHER_APP_ID   ?? '2150739',
    key:     process.env.PUSHER_KEY      ?? '13890cf18bf6ba41dc0d',
    secret:  process.env.PUSHER_SECRET   ?? 'fc3549cc63a5a1bc5523',
    cluster: process.env.PUSHER_CLUSTER  ?? 'ap2',
  },
  game: {
    ticketPrice: {
      CASUAL: parseFloat(process.env.TICKET_PRICE_CASUAL || '10'),
      STANDARD: parseFloat(process.env.TICKET_PRICE_STANDARD || '20'),
      PRO: parseFloat(process.env.TICKET_PRICE_PRO || '50'),
      JACKPOT: parseFloat(process.env.TICKET_PRICE_JACKPOT || '100'),
    },
    minPlayers: {
      CASUAL: 1,
      STANDARD: 1,
      PRO: 1,
      JACKPOT: 1,
    },
    countdown: {
      2: 30,   // 2 players → 30s
      5: 15,   // 5+ players → 15s
      20: 5,   // 20+ players → 5s
    } as Record<number, number>,
    drawIntervalMs: 3000,         // 3 seconds between draws
    houseEdgePercent: parseFloat(process.env.HOUSE_EDGE_PERCENT || '10'),
    totalNumbers: 75,             // standard bingo 1-75
  },
  withdrawal: {
    minAmount: parseFloat(process.env.MIN_WITHDRAWAL || '50'),
    maxAmount: parseFloat(process.env.MAX_WITHDRAWAL || '10000'),
  },
};
