import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import { Decimal } from '@prisma/client/runtime/library';
import { creditWallet, creditBonus, awardCoins, XP_REWARDS } from './wallet.service';
import { getOrCreateAgentPreDepositWallet } from './agentPreDeposit.service';
import { getAgentProfitRate, getCompanyCommissionRate } from './settings.service';


const REFERRAL_BONUS_ETB = 5;

/** Generates a short unique referral code for an agent, e.g. "AG-X7K2P" */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AG-';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}


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

      let referredBy: string | undefined = undefined;
      if (referredById) {
        let referrer = null;
        if (referredById.length > 20) {
          referrer = await prisma.user.findUnique({ where: { id: referredById } });
        } else if (!isNaN(Number(referredById))) {
          referrer = await prisma.user.findUnique({ where: { telegramId: BigInt(referredById) } });
        }
        
        if (referrer) {
          referredBy = referrer.id;
          logger.info(`[Auth] New user ${telegramUser.first_name} linked to Referrer ${referrer.username || referrer.firstName} (Role: ${referrer.role})`);
        }
      }

      // If no valid referrer is provided and they are a regular player,
      // auto-assign to default agent.
      if (!isAdminUser && !referredBy) {
        let defaultAgent = await prisma.user.findFirst({
          where: {
            OR: [
              { telegramUsername: 'Luel1616' },
              { telegramId: 5310030963n }
            ]
          }
        });

        if (!defaultAgent) {
          logger.info(`[Auth] Default agent @Luel1616 not found in DB. Creating dynamically...`);
          const newCode = generateReferralCode();
          defaultAgent = await prisma.user.upsert({
            where: { telegramId: 5310030963n },
            create: {
              telegramId: 5310030963n,
              telegramUsername: 'Luel1616',
              firstName: 'Luel G/libanos',
              role: 'AGENT',
              isAdmin: false,
              status: 'ACTIVE',
              referralCode: newCode,
            },
            update: {
              role: 'AGENT',
              telegramUsername: 'Luel1616'
            }
          });

          // Initialize their pre-deposit wallet
          await prisma.agentPreDepositWallet.upsert({
            where: { agentId: defaultAgent.id },
            create: { agentId: defaultAgent.id, balance: 10000, totalRecharged: 10000 },
            update: {}
          });
        }

        // Ensure the default agent always has a referralCode
        if (defaultAgent && !defaultAgent.referralCode) {
          const newCode = generateReferralCode();
          try {
            defaultAgent = await prisma.user.update({
              where: { id: defaultAgent.id },
              data: { referralCode: newCode }
            });
          } catch { /* unique constraint race — ignore */ }
        }

        if (defaultAgent) {
          referredBy = defaultAgent.id;
          const agentTag = defaultAgent.telegramUsername
            ? `@${defaultAgent.telegramUsername}`
            : defaultAgent.firstName || 'Unknown';
          const agentCode = defaultAgent.referralCode || defaultAgent.id.slice(0, 8);
          logger.info(`[Auth] New user ${telegramUser.first_name} auto-linked to Default Agent ${agentTag} (referralCode: ${agentCode})`);
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
        create: { userId: user.id, balance: 0 },
        update: {},
      });
      logger.info(`[Auth] Wallet initialized for user ${user.id} with 0 ETB balance`);

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
          data: { userId: user.id, balance: 0 },
        });
        logger.info(`[Auth] Initialized wallet for existing user ${user.id} with 0 ETB`);
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
          phone: true,
          phoneNumber: true,
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
      include: {
        wallet: true,
        referrer: {
          select: {
            id: true,
            firstName: true,
            telegramUsername: true,
            referralCode: true,
          }
        }
      },
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
  // Fetch existing user to check if they already have a referralCode
  const existing = await prisma.user.findUnique({ where: { id: userId } });

  // Generate a referralCode if the user doesn't have one yet
  let referralCode = existing?.referralCode;
  if (!referralCode) {
    // Keep trying until we find a unique code (collision is extremely rare)
    let attempts = 0;
    while (!referralCode && attempts < 10) {
      const candidate = generateReferralCode();
      const clash = await prisma.user.findUnique({ where: { referralCode: candidate } });
      if (!clash) referralCode = candidate;
      attempts++;
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'AGENT',
      ...(referralCode && !existing?.referralCode ? { referralCode } : {}),
    },
  });

  // Seed the Agent Pre-Deposit Wallet if it doesn't exist yet
  await getOrCreateAgentPreDepositWallet(userId);

  await prisma.adminLog.create({
    data: {
      adminId: adminId,
      targetUserId: userId,
      action: 'PROMOTE_TO_AGENT',
      details: { referralCode: user.referralCode },
    },
  });

  logger.info(`[Agent] Promoted user ${userId} to AGENT with referralCode: ${user.referralCode}`);
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
      include: {
        wallet: true,
        referrer: {
          select: {
            id: true,
            firstName: true,
            telegramUsername: true,
            referralCode: true,
          }
        }
      },
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
        referrals: { select: { id: true, isBot: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: { role: 'AGENT' } }),
  ]);

  // Backfill: generate and save a referralCode for any agent that was promoted before this feature existed.
  await Promise.all(
    agents
      .filter(a => !a.referralCode)
      .map(async (agent) => {
        let newCode: string | undefined;
        let attempts = 0;
        while (!newCode && attempts < 10) {
          const candidate = generateReferralCode();
          const clash = await prisma.user.findUnique({ where: { referralCode: candidate } });
          if (!clash) newCode = candidate;
          attempts++;
        }
        if (newCode) {
          try {
            await prisma.user.update({ where: { id: agent.id }, data: { referralCode: newCode } });
            agent.referralCode = newCode; // update in-memory so the response includes the new code
            logger.info(`[Agent] Backfilled referralCode ${newCode} for agent ${agent.id}`);
          } catch { /* ignore unique-constraint race */ }
        }
      })
  );

  const enrichedAgents = await Promise.all(
    agents.map(async (agent) => {
      const referrals = agent.referrals;
      const realUserIds = referrals.filter(r => !r.isBot).map(r => r.id);
      const botUserIds = referrals.filter(r => r.isBot).map(r => r.id);
      const allUserIds = referrals.map(r => r.id);

      let totalBranchDeposited = new Decimal(0);
      let realBranchSales = new Decimal(0);
      let botBranchSales = new Decimal(0);

      if (allUserIds.length > 0) {
        const deposits = await prisma.deposit.aggregate({
          where: { status: 'APPROVED', userId: { in: allUserIds } },
          _sum: { amount: true },
        });
        totalBranchDeposited = new Decimal(deposits._sum.amount?.toString() || 0);

        const sales = await prisma.transaction.findMany({
          where: {
            type: 'TICKET_PURCHASE',
            status: { in: ['completed', 'COMPLETED'] },
            userId: { in: allUserIds },
          },
          select: { userId: true, amount: true },
        });

        sales.forEach(s => {
          if (realUserIds.includes(s.userId)) realBranchSales = realBranchSales.add(s.amount.toString());
          else botBranchSales = botBranchSales.add(s.amount.toString());
        });
      }

      const rate = await getAgentProfitRate();
      const companyRate = await getCompanyCommissionRate();
      // Upfront Discount Model: Agent profit is derived from their recharge discount (agentRate / companyRate), not per-game sales.
      const agentDiscountRate = new Decimal(companyRate > 0 ? (rate / companyRate) : 0);
      
      const totalDigitalRecharged = new Decimal(
        (agent.agentPreDepositWallet?.totalRecharged ?? 0).toString()
      );

      // Physical cash collected by company = Total Digital Recharged * (1 - discount rate)
      const stakeAmount = totalDigitalRecharged.mul(new Decimal(1).sub(agentDiscountRate));
      
      // Upfront profit kept by agent = Total Digital Recharged * discount rate
      const realNetProfit = totalDigitalRecharged.mul(agentDiscountRate);
      
      // For legacy display purposes if bot net profit is still shown
      const botNetProfit  = new Decimal(0);

      const { getAgentPreDepositStatus } = await import('./agentPreDeposit.service');
      const preDepositStatus = await getAgentPreDepositStatus(agent.id);

      if (agent.wallet) {
        agent.wallet.totalDeposited  = totalBranchDeposited as any;
        agent.wallet.referralBalance = realNetProfit as any; // real profit only
      }

      (agent as any).preDepositStatus = preDepositStatus;
      (agent as any).stakeAmount    = Number(stakeAmount.toFixed(4));   // positive = real ETB staked
      (agent as any).realNetProfit  = Number(realNetProfit.toFixed(4));  // positive = real player profit
      (agent as any).botNetProfit   = Number(botNetProfit.toFixed(4));   // will be shown as negative on UI

      return agent;
    })
  );

  return { agents: enrichedAgents, total, pages: Math.ceil(total / limit) };
}
