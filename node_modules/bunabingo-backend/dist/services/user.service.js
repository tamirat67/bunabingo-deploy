"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUser = findOrCreateUser;
exports.getUserById = getUserById;
exports.getUserByTelegramId = getUserByTelegramId;
exports.getAllUsers = getAllUsers;
exports.suspendUser = suspendUser;
exports.banUser = banUser;
exports.isAdmin = isAdmin;
exports.updateUserPhone = updateUserPhone;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
async function findOrCreateUser(telegramUser, referredById, phone) {
    const telegramId = BigInt(telegramUser.id);
    logger_1.logger.info(`[Auth] findOrCreateUser triggered for TG ID: ${telegramId.toString()}`);
    try {
        let user = await prisma_1.default.user.findUnique({ where: { telegramId } });
        if (!user) {
            logger_1.logger.info(`[Auth] User not found. Creating new user record...`);
            user = await prisma_1.default.user.create({
                data: {
                    telegramId,
                    telegramUsername: telegramUser.username,
                    firstName: telegramUser.first_name,
                    lastName: telegramUser.last_name,
                    isAdmin: config_1.config.bot.adminIds.includes(telegramUser.id.toString()),
                    role: config_1.config.bot.adminIds.includes(telegramUser.id.toString()) ? 'admin' : 'player',
                    referredById: referredById && referredById.length > 20 ? referredById : undefined,
                    phoneNumber: phone || undefined,
                },
            });
            logger_1.logger.info(`[Auth] User record created: ${user.id}`);
            await prisma_1.default.wallet.upsert({
                where: { userId: user.id },
                create: { userId: user.id, balance: 0 },
                update: {},
            });
            logger_1.logger.info(`[Auth] Wallet initialized for user ${user.id}`);
            if (user.referredById) {
                await prisma_1.default.wallet.update({
                    where: { userId: user.referredById },
                    data: { balance: { increment: 2 } },
                });
                logger_1.logger.info(`[Auth] Referral bonus awarded to parent ${user.referredById}`);
            }
            logger_1.logger.info(`🎉 [Auth] New user registered: ${user.firstName} (TG: ${telegramId})`);
        }
        else {
            logger_1.logger.info(`[Auth] Returning existing user: ${user.firstName} (ID: ${user.id})`);
            user = await prisma_1.default.user.update({
                where: { id: user.id },
                data: {
                    telegramUsername: telegramUser.username || user.telegramUsername,
                    firstName: telegramUser.first_name || user.firstName,
                    lastName: telegramUser.last_name || user.lastName,
                },
            });
            const wallet = await prisma_1.default.wallet.findUnique({ where: { userId: user.id } });
            if (!wallet) {
                await prisma_1.default.wallet.create({ data: { userId: user.id, balance: 0 } });
                logger_1.logger.info(`[Auth] Created missing wallet for user ${user.id}`);
            }
        }
        return user;
    }
    catch (err) {
        logger_1.logger.error(`[Auth] FATAL ERROR in findOrCreateUser for TG ${telegramId}:`, err);
        throw err;
    }
}
async function getUserById(userId) {
    return prisma_1.default.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
    });
}
async function getUserByTelegramId(telegramId) {
    return prisma_1.default.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { wallet: true },
    });
}
async function getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        prisma_1.default.user.findMany({
            skip,
            take: limit,
            include: { wallet: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.default.user.count(),
    ]);
    return { users, total, pages: Math.ceil(total / limit) };
}
async function suspendUser(userId, adminId, reason) {
    await prisma_1.default.user.update({ where: { id: userId }, data: { status: 'suspended' } });
}
async function banUser(userId, adminId, reason) {
    await prisma_1.default.user.update({ where: { id: userId }, data: { status: 'banned' } });
}
function isAdmin(telegramId) {
    return config_1.config.bot.adminIds.includes(telegramId.toString());
}
async function updateUserPhone(telegramId, phoneNumber) {
    return prisma_1.default.user.update({
        where: { telegramId: BigInt(telegramId) },
        data: { phoneNumber },
    });
}
//# sourceMappingURL=user.service.js.map