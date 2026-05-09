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
exports.startJobs = startJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const fraud_detector_1 = require("./fraud.detector");
const logger_1 = require("../lib/logger");
const SELF_URL = 'https://bunabingo.onrender.com/health';
function startJobs() {
    // Fraud detection every 30 minutes
    node_cron_1.default.schedule('*/30 * * * *', async () => {
        try {
            await (0, fraud_detector_1.runFraudDetection)();
        }
        catch (err) {
            logger_1.logger.error('[Jobs] Fraud detection error:', err);
        }
    });
    // Cleanup cancelled/old waiting games every hour
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
            const staleDate = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const stale = await prisma.game.findMany({
                where: { status: 'WAITING', createdAt: { lt: staleDate }, tickets: { none: {} } },
            });
            if (stale.length) {
                await prisma.game.updateMany({
                    where: { id: { in: stale.map(g => g.id) } },
                    data: { status: 'CANCELLED', cancelReason: 'Stale waiting game (auto-cleanup)' },
                });
                logger_1.logger.info(`[Jobs] Cleaned up ${stale.length} stale waiting games`);
            }
        }
        catch (err) {
            logger_1.logger.error('[Jobs] Cleanup error:', err);
        }
    });
    // DB & Server keep-alive ping every 4 minutes
    node_cron_1.default.schedule('*/4 * * * *', async () => {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
            await prisma.$queryRaw `SELECT 1`;
            // Also ping self to keep Render awake
            await axios_1.default.get(SELF_URL);
        }
        catch (err) {
            logger_1.logger.warn('[Jobs] Keep-alive ping failed, reconnecting...');
            try {
                const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
                await prisma.$disconnect();
                await prisma.$connect();
            }
            catch (_) { }
        }
    });
    logger_1.logger.info('✅ Background jobs started (fraud scan every 30min, cleanup every 1h, DB ping every 4min)');
}
//# sourceMappingURL=index.js.map