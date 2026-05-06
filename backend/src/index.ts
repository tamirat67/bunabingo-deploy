import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createBot } from './bot';
import { initializeRooms } from './game/room.manager';
import { apiLimiter } from './middleware/rateLimit';
import apiRoutes from './routes/api';
import { logger } from './lib/logger';
import { config } from './config';
import prisma from './lib/prisma';
import { startJobs } from './jobs';

async function main() {
  // Global BigInt JSON serialization fix
  (BigInt.prototype as any).toJSON = function() {
    return this.toString();
  };

  // ─── Express Server ──────────────────────────────────────
  const app = express();
  app.set('trust proxy', 1); // Required for Render/Heroku reverse proxy

  app.use(cors({
    origin: '*',
    credentials: true
  }));
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.use('/api', apiLimiter, apiRoutes);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(config.server.port, () => {
    logger.info(`🚀 API server running on port ${config.server.port}`);
  });

  // ─── Database ────────────────────────────────────────────
  await prisma.$connect();
  logger.info('✅ Database connected');

  // ─── Initialize Rooms ────────────────────────────────────
  await initializeRooms();
  logger.info('✅ Game rooms initialized');

  // ─── Background Jobs ─────────────────────────────────────
  startJobs();

  // ─── Telegram Bot ────────────────────────────────────────
  const bot = createBot();

  if (config.server.nodeEnv === 'production') {
    // Webhook mode for production
    const webhookUrl = `${process.env.WEBHOOK_URL}/bot${config.bot.token}`;
    const miniAppUrl = (process.env.MINI_APP_URL?.startsWith('http') 
      ? process.env.MINI_APP_URL 
      : `https://${process.env.MINI_APP_URL}`) || 'https://bunabingo.vercel.app';
    await bot.telegram.setWebhook(webhookUrl);
    
    // Explicitly set the Menu Button (the keyboard Mini App button)
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: '🎰 Play Bingo Now',
        web_app: { url: `${config.bot.miniAppUrl}` }
      }
    });

    app.use(`/bot${config.bot.token}`, (req, res) => {
      bot.handleUpdate(req.body, res);
    });
    logger.info(`🤖 Bot running via webhook: ${webhookUrl}`);
  } else {
    // Long polling for development
    await bot.telegram.deleteWebhook();
    bot.launch();
    logger.info('🤖 Bot running via long polling');
  }

  // ─── Graceful Shutdown ───────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down...`);
    bot.stop(signal);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
