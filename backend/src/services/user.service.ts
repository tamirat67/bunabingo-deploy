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

  let user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        telegramUsername: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        isAdmin: config.bot.adminIds.includes(telegramUser.id),
        referredById: referredById && referredById.length > 20 ? referredById : undefined,
        phoneNumber: phoneNumber || undefined,
      },
    });

    // Create wallet
    await prisma.wallet.create({ data: { userId: user.id } });

    if (user.referredById) {
      await prisma.user.update({
        where: { id: user.referredById },
        data: { referralCount: { increment: 1 } }
      });
    }

    logger.info(`New user registered: ${user.firstName} (TG: ${telegramUser.id})`);
  } else {
    // Update last active & username
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
        telegramUsername: telegramUser.username ?? user.telegramUsername,
      },
    });
  }

  return user;
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
  return config.bot.adminIds.includes(telegramId);
}
