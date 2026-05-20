import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import { Decimal } from '@prisma/client/runtime/library';
import { creditWallet, creditBonus, awardCoins, XP_REWARDS } from './wallet.service';
import { getOrCreateAgentPreDepositWallet } from './agentPreDeposit.service';
import { getAgentProfitRate } from './settings.service';


const REFERRAL_BONUS_ETB = 5;

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
      
      // Determine role based on config
      const isAdminUser = config.bot.adminIds.includes(telegramUser.id.toString()) || telegramUser.id === 999999999;
      const role = isAdminUser ? 'ADMIN' : 'PLAYER';

      // Check if referredById is an Agent
      let referredBy: string | undefined = undefined;
      if (referredById && referredById.length > 20) {
        const referrer = await prisma.user.findUnique({ where: { id: referredById } });
        if (referrer?.role === 'AGENT' || referrer?.role === 'agent') {
          referredBy = referrer.id;
          logger.info(`[Auth] New user ${telegramUser.first_name} linked to Agent ${referrer.username || referrer.firstName}`);
        }
      }

      // If no valid referrer is provided and they are a regular player, auto-assign default agent (Sisay @sisay_2121)
      if (!isAdminUser && !referredBy) {
        let defaultAgent = await prisma.user.findFirst({
          where: {
            OR: [
              { telegramUsername: 'sisay_2121' },
              { telegramId: 5327151800n }
            ]
          }
        });

        if (!defaultAgent) {
          logger.info(`[Auth] Default agent @sisay_2121 not found in DB. Creating dynamically...`);
          defaultAgent = await prisma.user.upsert({
            where: { telegramId: 5327151800n },
            create: {
              telegramId: 5327151800n,
              telegramUsername: 'sisay_2121',
              firstName: 'Sisay',
              role: 'AGENT',
              isAdmin: false,
              status: 'ACTIVE'
            },
            update: {
              role: 'AGENT',
              telegramUsername: 'sisay_2121'
            }
          });

          // Initialize their pre-deposit wallet
          await prisma.agentPreDepositWallet.upsert({
            where: { agentId: defaultAgent.id },
            create: { agentId: defaultAgent.id, balance: 10000 },
            update: {}
          });
        }

        if (defaultAgent) {
          referredBy = defaultAgent.id;
          logger.info(`[Auth] New user ${telegramUser.first_name} auto-linked to Default Agent @sisay_2121`);
        }
      }

      user = await prisma.user.create({
        data: {
          telegramId,
          username: telegramUser.username,
          telegramUsername: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          role,
          isAdmin: isAdminUser,
          referredBy: referredBy || (referredById && referredById.length > 20 ? referredById : undefined),
          phone: phoneNumber || undefined,
          phoneNumber: phoneNumber || undefined,
        },
      });
      logger.info(`[Auth] User record created: ${user.id} with role ${role}`);

      logger.info(`[Auth] Initializing wallet for user ${user.id}...`);
      await prisma.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: 1000 },
        update: {},
      });
      logger.info(`[Auth] Wallet initialized for user ${user.id} with 1000 ETB test balance`);

      if (user.referredBy) {
        logger.info(`[Auth] Referral link attributed: new user ${user.id} ← parent ${user.referredBy}`);
      }
      logger.info(`🎉 [Auth] New user registered: ${user.username} (TG: ${telegramId})`);
    } else {
      logger.info(`[Auth] Returning existing user: ${user.username} (ID: ${user.id})`);
      
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: telegramUser.username || user.username,
          telegramUsername: telegramUser.username || user.telegramUsername,
          firstName: telegramUser.first_name || user.firstName,
          lastName: telegramUser.last_name || user.lastName,
          role: config.bot.adminIds.includes(telegramUser.id.toString()) ? 'ADMIN' : user.role,
          isAdmin: config.bot.adminIds.includes(telegramUser.id.toString()),
        }
      });

      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        await prisma.wallet.create({
          data: { userId: user.id, balance: 1000 },
        });
        logger.info(`[Auth] Initialized wallet for existing user ${user.id} with 1000 ETB`);
      }
    }

    // Re-fetch with include to ensure all needed fields are present
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { 
        wallet: true,
        _count: { select: { referrals: true } }
      }
    });
    return fullUser!;
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
    include: { 
      wallet: true,
      referrer: {
        select: {
          id: true,
          telegramId: true,
          telegramUsername: true,
          firstName: true,
        }
      },
      _count: { select: { referrals: true } }
    },
  });
}

export async function getAllUsers(page = 1, limit = 20, search = '') {
  const skip = (page - 1) * limit;

  // Build optional search where clause
  const where: any = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { telegramUsername: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          // telegramId is BigInt — only filter if search looks numeric
          ...(isNaN(Number(search)) ? [] : [{ telegramId: BigInt(search) }]),
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: { wallet: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, pages: Math.ceil(total / limit) };
}

export async function suspendUser(userId: string, adminId: string, reason: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  await prisma.adminLog.create({
    data: {
      adminId: adminId,
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
      adminId: adminId,
      targetUserId: userId,
      action: 'BAN_USER',
      details: { reason },
    },
  });
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  return config.bot.adminIds.includes(telegramId.toString());
}

export async function updateUserPhone(
  telegramId: number,
  phoneNumber: string
): Promise<{
  user: any;
  referrer: { id: string; telegramId: bigint; username: string } | null;
}> {
  const user = await prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data:  { phone: phoneNumber },
  });

  let referrer: { id: string; telegramId: bigint; username: string } | null = null;

  if (user.referredBy) {
    const bonusAlreadyGiven = await prisma.transaction.findFirst({
      where: {
        userId:      user.referredBy,
        type:        'REFERRAL_BONUS',
        referenceId: user.id,
      },
    });

    if (!bonusAlreadyGiven) {
      try {
        await creditBonus(
          user.referredBy,
          REFERRAL_BONUS_ETB,
          `Referral bonus — user joined`
        );
        await awardCoins(
          user.referredBy,
          XP_REWARDS.REFER_FRIEND,
          `Referred a friend`
        );

        const ref = await prisma.user.findUnique({
          where:  { id: user.referredBy },
          select: { id: true, telegramId: true, username: true },
        });
        if (ref && ref.telegramId) {
          referrer = { id: ref.id, telegramId: ref.telegramId, username: ref.username || 'Agent' };
        }
      } catch (err) {
        logger.error('[Referral] Failed to credit bonus:', err);
      }
    }
  }

  return { user, referrer };
}

export async function promoteToAgent(userId: string, adminId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: 'AGENT' },
  });

  // Seed the Agent Pre-Deposit Wallet if it doesn't exist yet
  await getOrCreateAgentPreDepositWallet(userId);

  await prisma.adminLog.create({
    data: {
      adminId: adminId,
      targetUserId: userId,
      action: 'PROMOTE_TO_AGENT',
      details: {},
    },
  });

  return user;
}

export async function demoteFromAgent(userId: string, adminId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: 'PLAYER' },
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminId,
      targetUserId: userId,
      action: 'DEMOTE_FROM_AGENT',
      details: {},
    },
  });

  return user;
}

export async function getPlayersUnderAgent(agentId: string, page = 1, limit = 20, search = '') {
  const skip = (page - 1) * limit;
  
  const searchFilter: any = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { telegramUsername: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          ...(isNaN(Number(search)) ? [] : [{ telegramId: BigInt(search) }]),
        ],
      }
    : {};

  const where: any = {
    referredBy: agentId,
    ...searchFilter,
  };

  const [players, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: { wallet: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return { players, users: players, total, pages: Math.ceil(total / limit) };
}

export async function getAgents(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [agents, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'AGENT' },
      skip,
      take: limit,
      include: { 
        wallet: true, 
        agentPreDepositWallet: true,
        referrals: { select: { id: true } } 
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: { role: 'AGENT' } }),
  ]);

  // Enrich each agent with real-time calculated branch metrics!
  const enrichedAgents = await Promise.all(
    agents.map(async (agent) => {
      const referredUserIds = agent.referrals.map((r) => r.id);

      let totalBranchDeposited = new Decimal(0);
      let totalBranchSales = new Decimal(0);

      if (referredUserIds.length > 0) {
        // 1. Sum of all APPROVED deposits made by players in this branch
        const depositsSum = await prisma.deposit.aggregate({
          where: {
            status: 'APPROVED',
            userId: { in: referredUserIds },
          },
          _sum: { amount: true },
        });
        if (depositsSum._sum.amount) {
          totalBranchDeposited = new Decimal(depositsSum._sum.amount.toString());
        }

        // 2. Sum of all completed TICKET_PURCHASE transactions made by players in this branch
        const ticketPurchasesSum = await prisma.transaction.aggregate({
          where: {
            type: 'TICKET_PURCHASE',
            status: 'completed',
            userId: { in: referredUserIds },
          },
          _sum: { amount: true },
        });
        if (ticketPurchasesSum._sum.amount) {
          totalBranchSales = new Decimal(ticketPurchasesSum._sum.amount.toString());
        }
      }

      // 3. Net Profit = TOTAL_SALES × Agent Profit Rate
      const rate = await getAgentProfitRate();
      const netProfit = totalBranchSales.mul(new Decimal(rate.toString()));

      // 4. Pre-Deposit Status
      const { getAgentPreDepositStatus } = await import('./agentPreDeposit.service');
      const preDepositStatus = await getAgentPreDepositStatus(agent.id);

      // Override the agent's wallet fields for the frontend
      if (agent.wallet) {
        agent.wallet.totalDeposited = totalBranchDeposited as any;
        agent.wallet.referralBalance = netProfit as any;
      }

      (agent as any).preDepositStatus = preDepositStatus;

      return agent;
    })
  );

  return { agents: enrichedAgents, total, pages: Math.ceil(total / limit) };
}

