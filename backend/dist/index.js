"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const bot_1 = require("./bot");
const room_manager_1 = require("./game/room.manager");
const rateLimit_1 = require("./middleware/rateLimit");
const api_1 = __importDefault(require("./routes/api"));
const logger_1 = require("./lib/logger");
const config_1 = require("./config");
const prisma_1 = __importStar(require("./lib/prisma"));
const jobs_1 = require("./jobs");
const bot = (0, bot_1.createBot)();
async function main() {
    // Global BigInt JSON serialization fix
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
    // ─── Express Server ──────────────────────────────────────
    const app = (0, express_1.default)();
    app.set('trust proxy', 1); // Required for Render/Heroku reverse proxy
    app.use((0, cors_1.default)({
        origin: '*',
        credentials: true
    }));
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: false,
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
    // Root route for testing
    app.get('/', (_req, res) => {
        res.send('Buna Bingo API is running! ☕');
    });
    // Health endpoint — must be before rate limiters so keep-alive always responds
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    app.use('/api', rateLimit_1.apiLimiter, api_1.default);
    const host = '0.0.0.0';
    const port = config_1.config.server.port;
    app.listen(port, host, () => {
        logger_1.logger.info(`🚀 API server running on ${host}:${port}`);
    });
    // ─── Database ────────────────────────────────────────────
    try {
        await (0, prisma_1.withRetry)(() => prisma_1.default.$connect());
        logger_1.logger.info('✅ Database connected');
    }
    catch (dbErr) {
        logger_1.logger.error('❌ Database connection failed after retries:', dbErr);
        // Continue anyway; Prisma will retry on the first real query
    }
    // ─── Initialize Rooms ────────────────────────────────────
    try {
        await (0, prisma_1.withRetry)(() => (0, room_manager_1.initializeRooms)());
        logger_1.logger.info('✅ Game rooms initialized');
    }
    catch (roomErr) {
        logger_1.logger.error('❌ Failed to initialize rooms:', roomErr);
    }
    // ─── Background Jobs ─────────────────────────────────────
    (0, jobs_1.startJobs)();
    // ─── Telegram Bot ────────────────────────────────────────
    // Non-blocking: don't await so server stays responsive during bot init
    (async () => {
        try {
            if (config_1.config.server.nodeEnv === 'production') {
                const webhookUrl = `${process.env.WEBHOOK_URL}/bot${config_1.config.bot.token}`;
                await bot.telegram.setWebhook(webhookUrl);
                await bot.telegram.setChatMenuButton({
                    menuButton: {
                        type: 'web_app',
                        text: 'Play Buna Bingo',
                        web_app: { url: `${config_1.config.bot.miniAppUrl}` }
                    }
                });
                app.use(`/bot${config_1.config.bot.token}`, (req, res) => {
                    bot.handleUpdate(req.body, res);
                });
                logger_1.logger.info(`🤖 Bot running via webhook: ${webhookUrl}`);
            }
            else {
                await bot.telegram.deleteWebhook();
                bot.launch();
                logger_1.logger.info('🤖 Bot running via long polling');
            }
        }
        catch (botErr) {
            logger_1.logger.error('Failed to initialize bot (non-fatal):', botErr);
        }
    })();
    // ─── Graceful Shutdown ───────────────────────────────────
    const shutdown = async (signal) => {
        logger_1.logger.info(`${signal} received — shutting down...`);
        try {
            bot.stop(signal);
        }
        catch (_) { }
        await prisma_1.default.$disconnect();
        process.exit(0);
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}
main().catch(err => {
    logger_1.logger.error('Fatal startup error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map