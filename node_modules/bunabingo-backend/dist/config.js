"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    bot: {
        token: process.env.BOT_TOKEN,
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
    pusher: {
        appId: process.env.PUSHER_APP_ID ?? '2150741',
        key: process.env.PUSHER_KEY ?? 'd4ef280cd11492e660ee',
        secret: process.env.PUSHER_SECRET ?? '479d0857765a59754594',
        cluster: process.env.PUSHER_CLUSTER ?? 'ap2',
    },
    game: {
        ticketPrice: {
            DEMO: 0,
            CASUAL: parseFloat(process.env.TICKET_PRICE_CASUAL || '10'),
            STANDARD: parseFloat(process.env.TICKET_PRICE_STANDARD || '20'),
            PRO: parseFloat(process.env.TICKET_PRICE_PRO || '50'),
            JACKPOT: parseFloat(process.env.TICKET_PRICE_JACKPOT || '100'),
        },
        minPlayers: {
            DEMO: 1,
            CASUAL: 1,
            STANDARD: 1,
            PRO: 1,
            JACKPOT: 1,
        },
        countdown: {
            2: 30, // 2 players → 30s
            5: 15, // 5+ players → 15s
            20: 5, // 20+ players → 5s
        },
        drawIntervalMs: 3000, // 3 seconds between draws
        houseEdgePercent: parseFloat(process.env.HOUSE_EDGE_PERCENT || '25'),
        totalNumbers: 75, // standard bingo 1-75
    },
    withdrawal: {
        minAmount: parseFloat(process.env.MIN_WITHDRAWAL || '200'),
        maxAmount: parseFloat(process.env.MAX_WITHDRAWAL || '10000'),
    },
    payment: {
        receiverName: process.env.PAYMENT_RECEIVER_NAME || 'Tame',
        receiverPhone: process.env.PAYMENT_RECEIVER_PHONE || '251966129707',
        telebirrPhone: process.env.PAYMENT_TELEBIRR_PHONE || '0997688294',
        supportAgent1: process.env.PAYMENT_SUPPORT_AGENT1 || '@bunabingosupport',
        supportAgent2: process.env.PAYMENT_SUPPORT_AGENT2 || '@bunabingosupport2',
        supportAdminId: process.env.SUPPORT_ADMIN_ID || '7005926343',
        bunaEngineHost: process.env.BUNA_ENGINE_HOST || 'https://rexhetmfgnf.aabte.com.et',
        bunaEngineKey: process.env.BUNA_ENGINE_KEY || '9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9',
    },
};
//# sourceMappingURL=config.js.map