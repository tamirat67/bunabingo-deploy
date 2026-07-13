import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { logger } from '../lib/logger';
import { config } from '../config';
import { Decimal } from '@prisma/client/runtime/library';
import { creditWallet, creditBonus, awardCoins, XP_REWARDS, grantWelcomeBonus } from './wallet.service';
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
              { telegramId: 6836036070n }
            ]
          }
        });

        if (!defaultAgent) {
          logger.info(`[Auth] Default agent @Luel1616 not found in DB. Creating dynamically...`);
          defaultAgent = await prisma.user.upsert({
            where: { telegramId: 6836036070n },
            create: {
              telegramId: 6836036070n,
              telegramUsername: 'Luel1616',
              firstName: 'Luel G/libanos',
              role: 'AGENT',
              isAdmin: false,
              status: 'ACTIVE',
              referralCode: 'AG-VL7MV',
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
          role: true,
          isAdmin: true,
        }
      },
      _count: { select: { referrals: true } }
    },
  });
}

/** Same as getUserByTelegramId but accepts BigInt directly to avoid
 *  precision loss when the ID exceeds Number.MAX_SAFE_INTEGER (2^53-1)
 *  or the old unsafe Number() cast that truncates IDs > 2^31.
 */
export async function getUserByTelegramIdBigInt(telegramId: bigint) {
  return prisma.user.findUnique({
    where: { telegramId },
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
          role: true,
          isAdmin: true,
        }
      },
      _count: { select: { referrals: true } }
    },
  });
}

export async function getAllUsers(page = 1, limit = 20, search = '', agentIds?: string[]) {
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
          ...(search.trim() !== '' && !isNaN(Number(search)) ? [{ telegramId: BigInt(search) }] : []),
        ],
      }
    : {};
    
  if (agentIds) {
    where.referredBy = { in: agentIds };
  }

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
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, pages: Math.ceil(total / limit) };
}

export async function getDescendantUserIds(agentId: string): Promise<string[]> {
  try {
    const result = await prisma.$queryRaw<{id: string}[]>`
      WITH RECURSIVE descendants(id, depth, path) AS (
        SELECT id, 1, ARRAY[id]
        FROM "users" 
        WHERE referred_by = ${agentId}::uuid
        
        UNION ALL
        
        SELECT u.id, d.depth + 1, d.path || u.id
        FROM "users" u
        INNER JOIN descendants d ON u.referred_by = d.id
        WHERE u.id <> ALL(d.path) AND d.depth < 10
      )
      SELECT id FROM descendants;
    `;
    return result.map(r => r.id);
  } catch (err) {
    logger.error('[user.service] Error in getDescendantUserIds:', err);
    return [];
  }
}

/**
 * Gets all players that belong to this agent's branch.
 * It traverses referrals recursively, but STOPS if it hits another Agent or Admin,
 * ensuring agents don't double-count players belonging to their sub-agents.
 */
export async function getBranchPlayerIds(agentId: string): Promise<string[]> {
  try {
    const result = await prisma.$queryRaw<{id: string}[]>`
      WITH RECURSIVE branch AS (
        -- Base case: direct referrals
        SELECT id, role
        FROM "users" 
        WHERE referred_by = ${agentId}::uuid AND is_bot = false
        
        UNION ALL
        
        -- Recursive step: referrals of the branch members (only if parent is not an agent)
        SELECT u.id, u.role
        FROM "users" u
        INNER JOIN branch b ON u.referred_by = b.id
        WHERE b.role NOT IN ('AGENT', 'ADMIN') AND u.is_bot = false
      )
      SELECT id FROM branch;
    `;
    return result.map(r => r.id);
  } catch (err) {
    logger.error('[user.service] Error in getBranchPlayerIds:', err);
    return [];
  }
}

export async function findAgentAncestor(userId: string): Promise<any | null> {
  const MAX_HOPS = 10;
  let currentId: string | null = userId;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!currentId) break;
    const current = await prisma.user.findUnique({
      where: { id: currentId },
      select: { id: true, role: true, referredBy: true, firstName: true, lastName: true,
                telegramUsername: true, phone: true, phoneNumber: true, depositPhones: true }
    });
    if (!current) break;
    if (hop > 0 && (current.role === 'AGENT' || current.role === 'ADMIN' || current.role === 'admin')) {
      return current;
    }
    currentId = current.referredBy ?? null;
  }
  return null;
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
  phoneNumber: string,
  generatePassword = false
): Promise<{
  user: any;
  referrer: { id: string; telegramId: bigint; username: string } | null;
  welcomeBonusGranted: boolean;
  generatedPassword?: string;
}> {
  let updateData: any = { phone: phoneNumber };
  let generatedPassword;

  if (generatePassword) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    generatedPassword = '';
    for (let i = 0; i < 10; i++) {
      generatedPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    updateData.passwordHash = passwordHash;
  }

  const user = await prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: updateData,
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

  // ── One-time 100 ETB welcome bonus for the new player ───────────────────────
  let welcomeBonusGranted = false;
  // DISABLED: New comers welcome bonus is disabled
  // try {
  //   welcomeBonusGranted = await grantWelcomeBonus(user.id);
  // } catch (err) {
  //   logger.error('[WelcomeBonus] Failed to grant welcome bonus:', err);
  // }

  return { user, referrer, welcomeBonusGranted, generatedPassword };
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
          ...(search.trim() !== '' && !isNaN(Number(search)) ? [{ telegramId: BigInt(search) }] : []),
        ],
      }
    : {};

  const descendantIds = await getDescendantUserIds(agentId);

  const where: any = {
    id: { in: descendantIds.length > 0 ? descendantIds : ['00000000-0000-0000-0000-000000000000'] },
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
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return { players, users: players, total, pages: Math.ceil(total / limit) };
}

export async function getAgents(page = 1, limit = 20, agentIds?: string[]) {
  const skip = (page - 1) * limit;
  const whereClause: any = { role: 'AGENT' };
  if (agentIds) {
    whereClause.id = { in: agentIds };
  }

  const [agents, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: { 
        wallet: true, 
        agentPreDepositWallet: true,
        referrals: { select: { id: true, isBot: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: whereClause }),
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
      const descendantIds = await getDescendantUserIds(agent.id);
      const descendantUsers = await prisma.user.findMany({
        where: { id: { in: descendantIds.length > 0 ? descendantIds : ['00000000-0000-0000-0000-000000000000'] } },
        select: { id: true, isBot: true }
      });

      const realUserIds = descendantUsers.filter(r => !r.isBot).map(r => r.id);
      const botUserIds = descendantUsers.filter(r => r.isBot).map(r => r.id);
      const allUserIds = descendantIds;

      let totalBranchDeposited = new Decimal(0);
      let totalBranchWithdrawn = new Decimal(0);
      let outstandingDebt = new Decimal(0);
      let realBranchSales = new Decimal(0);
      let botBranchSales = new Decimal(0);

      if (allUserIds.length > 0) {
        const [depositsAgg, withdrawnAgg, pendingWdAgg, sales, settlementsAgg] = await Promise.all([
          // Total approved deposits from branch players (cash brought in)
          prisma.deposit.aggregate({
            where: { status: 'APPROVED', userId: { in: allUserIds } },
            _sum: { amount: true },
          }),
          // Total approved withdrawals from branch players (cash paid out)
          prisma.withdrawal.aggregate({
            where: { status: 'approved', userId: { in: allUserIds } },
            _sum: { amount: true },
          }),
          // Pending withdrawals = Outstanding Debt the agent owes to players
          prisma.withdrawal.aggregate({
            where: { status: 'pending', userId: { in: allUserIds } },
            _sum: { amount: true },
          }),
          // Ticket sales (for commission calculations)
          prisma.transaction.findMany({
            where: {
              type: 'TICKET_PURCHASE',
              status: { in: ['completed', 'COMPLETED'] },
              userId: { in: allUserIds },
            },
            select: { userId: true, amount: true },
          }),
          // All-time physical cash collected from this agent
          prisma.agentSettlement.aggregate({
            where: { agentId: agent.id },
            _sum: { amount: true },
          })
        ]);

        totalBranchDeposited = new Decimal(depositsAgg._sum.amount?.toString() || 0);
        totalBranchWithdrawn = new Decimal(withdrawnAgg._sum.amount?.toString() || 0);
        outstandingDebt = new Decimal(pendingWdAgg._sum.amount?.toString() || 0);
        
        // Sum of all past cash collections (AgentSettlements)
        const allTimeCollected = new Decimal(settlementsAgg._sum?.amount?.toString() || 0);

        sales.forEach((s: any) => {
          if (realUserIds.includes(s.userId)) realBranchSales = realBranchSales.add(s.amount.toString());
          else botBranchSales = botBranchSales.add(s.amount.toString());
        });
        
        // Expose allTimeCollected out of scope
        (agent as any)._allTimeCollected = allTimeCollected;
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

      const { getAgentPreDepositStatus } = await import('./agentPreDeposit.service');
      const preDepositStatus = await getAgentPreDepositStatus(agent.id);

      if (agent.wallet) {
        // Override wallet fields with branch-level aggregates for accurate admin display
        agent.wallet.totalDeposited  = totalBranchDeposited as any;
        agent.wallet.totalWithdrawn  = totalBranchWithdrawn as any;
        agent.wallet.referralBalance = realNetProfit as any; // agent's upfront discount profit
      }

      // Override referrals so the frontend displays the full nested player count
      (agent as any).referrals = descendantUsers;
      if (!(agent as any)._count) (agent as any)._count = {};
      (agent as any)._count.referrals = descendantUsers.length;

      // Calculate outstanding company profit debt (Expected collection this period)
      const ncf = Decimal.max(0, totalBranchDeposited.sub(totalBranchWithdrawn));
      const ncfAgentEarned = ncf.mul(agentDiscountRate);
      const expectedTotalCash = ncf.sub(ncfAgentEarned);
      const allTimeCollected = (agent as any)._allTimeCollected || new Decimal(0);
      const outstandingCollectionDebt = Decimal.max(0, expectedTotalCash.sub(allTimeCollected));

      (agent as any).preDepositStatus = preDepositStatus;
      (agent as any).stakeAmount      = Number(stakeAmount.toFixed(4));      // ETB company physically collected
      (agent as any).realNetProfit    = Number(realNetProfit.toFixed(4));     // agent's kept discount profit
      (agent as any).outstandingDebt  = Number(outstandingDebt.toFixed(4));  // pending withdrawals = cash agent owes players
      (agent as any).outstandingCollectionDebt = Number(outstandingCollectionDebt.toFixed(2)); // Cash agent owes company
      (agent as any).botNetProfit     = 0; // legacy field, kept for compatibility

      return agent;
    })
  );

  return { agents: enrichedAgents, total, pages: Math.ceil(total / limit) };
}
