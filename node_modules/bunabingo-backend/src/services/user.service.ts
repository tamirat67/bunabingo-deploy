import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';

export async function findOrCreateUser(
  telegramUser: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  },
  referredById?: string,
  phoneNumber?: string
) {
  const telegramId = BigInt(telegramUser.id);
  logger.info(`[Auth] findOrCreateUser triggered for TG ID: ${telegramId.toString()}`);

  try {
    logger.info(`[Auth] Checking DB for user ${telegramId.toString()}...`);
    let user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      logger.info(`[Auth] User not found. Creating new user record...`);
      user = await prisma.user.create({
        data: {
          telegramId,
          telegramUsername: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          isAdmin: config.bot.adminIds.includes(telegramUser.id.toString()),
          referredById: referredById && referredById.length > 20 ? referredById : undefined,
          phoneNumber: phoneNumber || undefined,
        },
      });
      logger.info(`[Auth] User record created: ${user.id}`);

      logger.info(`[Auth] Initializing wallet for user ${user.id}...`);
      await prisma.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: 1000 },
        update: {},
      });
      logger.info(`[Auth] Wallet initialized for user ${user.id}`);

      if (user.referredById) {
        logger.info(`[Auth] Processing referral for parent ${user.referredById}...`);
        await prisma.user.update({
          where: { id: user.referredById },
          data: { referralCount: { increment: 1 } }
        });
        
        // Award referral bonus to parent wallet
        await prisma.wallet.update({
          where: { userId: user.referredById },
          data: { balance: { increment: 2 } } // 2 ETB Bonus
        });
        logger.info(`[Auth] Referral bonus awarded to parent ${user.referredById}`);
      }
      logger.info(`🎉 [Auth] New user registered: ${user.firstName} (TG: ${telegramId})`);
    } else {
      logger.info(`[Auth] Returning existing user: ${user.firstName} (ID: ${user.id})`);
      
      // LIVE SYNC: Update name and username in case they changed in Telegram
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramUsername: telegramUser.username || user.telegramUsername,
          firstName: telegramUser.first_name || user.firstName,
          lastName: telegramUser.last_name || user.lastName,
        }
      });

      // Ensure they have a test bankroll (refill if < 100)
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet || Number(wallet.balance) < 100) {
        await prisma.wallet.upsert({
          where: { userId: user.id },
          create: { userId: user.id, balance: 1000 },
          update: { balance: 1000 },
        });
        logger.info(`[Auth] Refilled existing user ${user.id} to 1000 ETB`);
      }
    }

    return user;
  } catch (err: any) {
    logger.error(`[Auth] FATAL ERROR in findOrCreateUser for TG ${telegramId}:`, err);
    throw err;
  }
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
}

export async function getUserByTelegramId(telegramId: number) {
  return prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: { wallet: true },
  });
}

export async function getAllUsers(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      include: { wallet: true },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.user.count(),
  ]);
  return { users, total, pages: Math.ceil(total / limit) };
}

export async function suspendUser(userId: string, adminId: string, reason: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  await prisma.adminLog.create({
    data: {
      adminId,
      targetUserId: userId,
      action: 'SUSPEND_USER',
      details: { reason },
    },
  });
}

export async function banUser(userId: string, adminId: string, reason: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
  await prisma.adminLog.create({
    data: {
      adminId,
      targetUserId: userId,
      action: 'BAN_USER',
      details: { reason },
    },
  });
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  return config.bot.adminIds.includes(telegramId.toString());
}

export async function updateUserPhone(telegramId: number, phoneNumber: string) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { phoneNumber },
  });
}
