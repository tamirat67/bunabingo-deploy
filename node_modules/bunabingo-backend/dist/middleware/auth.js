"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuthMiddleware = telegramAuthMiddleware;
exports.adminMiddleware = adminMiddleware;
const user_service_1 = require("../services/user.service");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../lib/logger");
/**
 * Validates Telegram Mini App initData and attaches user to req
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
async function telegramAuthMiddleware(req, res, next) {
    try {
        const initData = req.headers['x-telegram-init-data'];
        const isDev = process.env.NODE_ENV !== 'production';
        // In dev mode with no initData: attach a mock test user so the browser works
        if (!initData) {
            if (isDev) {
                const devUser = await (0, user_service_1.findOrCreateUser)({
                    id: 999999999,
                    username: 'dev_tester',
                    first_name: 'Dev',
                    last_name: 'Tester',
                });
                req.user = devUser;
                return next();
            }
            return res.status(401).json({ error: 'Missing Telegram auth data' });
        }
        // Parse and validate initData
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash)
            return res.status(401).json({ error: 'Invalid auth data' });
        params.delete('hash');
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(process.env.BOT_TOKEN)
            .digest();
        const expectedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        if (expectedHash !== hash) {
            logger_1.logger.warn(`[Auth] Hash mismatch! Possible BOT_TOKEN mismatch on server.`);
            logger_1.logger.warn(`[Auth] Expected: ${expectedHash.slice(0, 10)}... Got: ${hash?.slice(0, 10)}...`);
            return res.status(401).json({ error: 'Invalid Telegram signature. Check BOT_TOKEN on server.' });
        }
        const userParam = params.get('user');
        if (!userParam)
            return res.status(401).json({ error: 'No user data' });
        const tgUser = JSON.parse(userParam);
        const startParam = params.get('start_param');
        // Look for user, but DO NOT CREATE
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (user) {
            if (user.status === 'BANNED')
                return res.status(403).json({ error: 'Account banned' });
            req.user = user;
        }
        else {
            // Not registered - attach tgUser so /auth/register can use it
            req.tgUser = { ...tgUser, startParam };
        }
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
}
/**
 * Admin-only middleware — runs after telegramAuthMiddleware
 */
function adminMiddleware(req, res, next) {
    const user = req.user;
    if (!user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
//# sourceMappingURL=auth.js.map