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
import prisma, { withRetry } from './lib/prisma';
import { startJobs } from './jobs';

export const bot = createBot();

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

  // Root route for testing
  app.get('/', (_req, res) => {
    res.send('Buna Bingo API is running! ☕');
  });

  // Health endpoint — must be before rate limiters so keep-alive always responds
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiLimiter, apiRoutes);

  const host = '0.0.0.0';
  const port = config.server.port;
  
  // ─── HTTP Server & Socket.io ─────────────────────────────
  const { createServer } = await import('http');
  const { initSocket } = await import('./lib/socket');
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(port, host, () => {
    logger.info(`🚀 API server running on ${host}:${port} (HTTP + Socket.io)`);
  });

  // ─── Database ────────────────────────────────────────────
  try {
    await withRetry(() => prisma.$connect());
    logger.info('✅ Database connected');
  } catch (dbErr) {
    logger.error('❌ Database connection failed after retries:', dbErr);
    // Continue anyway; Prisma will retry on the first real query
  }

  // ─── Initialize Rooms & Cycle Cache ──────────────────────
  try {
    const { initializeCycleCache } = await import('./services/houseBot.service');
    await withRetry(() => initializeCycleCache());
    logger.info('✅ Bot cycle cache initialized');
    await withRetry(() => initializeRooms());
    logger.info('✅ Game rooms initialized');
  } catch (roomErr) {
    logger.error('❌ Failed to initialize rooms/cache:', roomErr);
  }

  // ─── Resume Countdowns (after server restart) ─────────────
  // Re-creates in-memory timers for any game stuck in COUNTDOWN
  // so all players see a live countdown immediately on reconnect.
  try {
    const { resumeActiveCountdowns, resumeRunningGames } = await import('./game/engine');
    await resumeActiveCountdowns();
    logger.info('✅ Active countdowns resumed');
    await resumeRunningGames();
    logger.info('✅ Active running games resumed');
  } catch (resumeErr) {
    logger.error('❌ Failed to resume countdowns/games:', resumeErr);
  }

  // ─── Background Jobs ─────────────────────────────────────
  startJobs(bot);

  // ─── Telegram Bot ────────────────────────────────────────

  // Non-blocking: don't await so server stays responsive during bot init
  (async () => {
    try {
      // ── Update bot description on startup ───────────────────────────────────
      const { updateBotDescription } = await import('./jobs/bot.description.updater');
      await updateBotDescription(bot);

      // ── Register commands in Telegram (command picker) ──────────────────────
      try {
        await bot.telegram.setMyCommands([
          // Core / Gaming
          { command: 'start',             description: '👋 Start the bot' },
          { command: 'playbingo',         description: '🎮 Start playing Bingo' },
          { command: 'register',          description: '📝 Register for an account' },
          // Wallet & Finance
          { command: 'balance',           description: '💰 Check account balance' },
          { command: 'deposit',           description: '💵 Deposit funds into your account' },
          { command: 'withdraw',          description: '💸 Withdraw funds' },
          { command: 'transfer',          description: '📤 Transfer funds to another user' },
          // History & Social
          { command: 'game_history',      description: '📜 Check your game history' },
          { command: 'check_transaction', description: '💳 Check your transaction history' },
          { command: 'invite',            description: '✉️ Invite your friends' },
          // Profile & Help
          { command: 'change_name',       description: '🆔 Change your account name' },
          { command: 'instruction',       description: '📖 View game instructions' },
          { command: 'support',           description: '📞 Contact support' },
        ]);
        logger.info('🤖 Bot commands registered with Telegram');
      } catch (err) {
        logger.error('Failed to set bot commands:', err);
      }

      // ── Set the Menu Button to 'commands' (to show the 'Menu' button in UI) ──
      try {
        await bot.telegram.setChatMenuButton({
          menuButton: {
            type: 'commands',
          },
        });
        logger.info('🤖 Chat Menu Button set to: commands list');
      } catch (err) {
        logger.error('Failed to set Chat Menu Button:', err);
      }

      if (config.server.nodeEnv === 'production') {
        const webhookUrl = `${process.env.WEBHOOK_URL}/bot${config.bot.token}`;
        try {
          await bot.telegram.setWebhook(webhookUrl);
          app.use(`/bot${config.bot.token}`, (req: any, res: any) => {
            bot.handleUpdate(req.body, res);
          });
          logger.info(`🤖 Bot running via webhook: ${webhookUrl}`);
        } catch (webhookErr: any) {
          logger.error('⚠️ Webhook setup failed, falling back to Long Polling:', webhookErr.message);
          await bot.telegram.deleteWebhook();
          bot.launch();
          logger.info('🤖 Bot running via long polling (Production Fallback)');
        }
      } else {
        await bot.telegram.deleteWebhook();
        bot.launch();
        logger.info('🤖 Bot running via long polling');
      }
    } catch (botErr) {
      logger.error('Failed to initialize bot (non-fatal):', botErr);
    }
  })();

  // ─── Graceful Shutdown ───────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down...`);
    try { bot.stop(signal); } catch (_) {}
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
