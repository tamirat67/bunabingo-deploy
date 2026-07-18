import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getBlastEventName, getBlastBannerText, getBlastRewardTiers, getBlastTargetDate } from './settings.service';
import winston from 'winston';

const prisma = new PrismaClient();

// Add logger if not imported globally
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export const WeeklyBlastService = {
  /**
   * Get the currently active event and the user's participation status
   */
  async getCurrentEvent(userId: string) {
    const activeEvent = await prisma.weeklyRewardEvent.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeEvent) {
      return { active: false };
    }

    const participant = await prisma.weeklyRewardParticipant.findFirst({
      where: {
        eventId: activeEvent.id,
        userId: userId,
      },
    });

    const eventName = await getBlastEventName();
    const bannerText = await getBlastBannerText();
    const rewardTiers = await getBlastRewardTiers();
    const targetDate = await getBlastTargetDate();

    // Sum total reward pool from tiers
    const totalRewardPool = rewardTiers.reduce((a, b) => a + b, 0);

    return {
      active: true,
      eventId: activeEvent.id,
      eventName,
      bannerText,
      totalWinners: rewardTiers.length,
      totalRewardPool,
      targetDate: targetDate ? targetDate.toISOString() : null,
      hasParticipated: !!participant,
      isWinner: participant?.isWinner || false,
      rewardAmount: participant?.rewardAmount || 0,
    };
  },

  /**
   * Calculate player's engagement score
   */
  async calculateScore(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Deposit Score (sum of deposits in last 7 days)
    const recentDeposits = await prisma.deposit.aggregate({
      where: {
        userId,
        status: 'completed',
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { amount: true },
    });
    const depositScore = Number(recentDeposits._sum.amount || 0);

    // 2. Performance Score (games played / tickets bought in last 7 days)
    const recentTickets = await prisma.ticket.count({
      where: {
        userId,
        purchasedAt: { gte: sevenDaysAgo },
      },
    });
    
    // Also include Aviator and Keno games in performance score
    const recentAviator = await prisma.aviatorBet.count({
      where: { userId, createdAt: { gte: sevenDaysAgo } }
    });
    const recentKeno = await prisma.kenoTicket.count({
      where: { userId, createdAt: { gte: sevenDaysAgo } }
    });

    const performanceScore = recentTickets + recentAviator + recentKeno;

    return {
      depositScore,
      performanceScore,
      // Total weight formula: adjust multipliers as needed.
      // Every 10 ETB deposited = 1 point. Every game played = 1 point.
      totalWeight: (depositScore / 10) + performanceScore + 1, // base weight of 1
    };
  },

  /**
   * Draw action for a user tapping the blast button
   */
  async draw(userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get active event
      const activeEvent = await tx.weeklyRewardEvent.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startedAt: 'desc' },
      });

      if (!activeEvent) {
        throw new Error('No active event found');
      }

      // 2. Check if user already participated
      const existing = await tx.weeklyRewardParticipant.findFirst({
        where: { eventId: activeEvent.id, userId },
      });

      if (existing) {
        throw new Error('User has already participated in this event');
      }

      // 3. Calculate score
      const { depositScore, performanceScore } = await this.calculateScore(userId);
      
      // 4. Create participant record (Enrollment)
      const participant = await tx.weeklyRewardParticipant.create({
        data: {
          eventId: activeEvent.id,
          userId,
          isWinner: false,
          rewardAmount: 0,
          depositScore,
          performanceScore,
        },
      });

      // No instant wins anymore. They wait for leaderboard distribution.

      return {
        isWinner: false,
        amount: 0,
        totalWinners: activeEvent.totalWinners, // this might be unused by frontend now
      };
    });
  },

  /**
   * Get leaderboard of top-performing players (based on performance score)
   */
  async getLeaderboard() {
    const activeEvent = await prisma.weeklyRewardEvent.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeEvent) return [];

    const allParticipants = await prisma.weeklyRewardParticipant.findMany({
      where: { eventId: activeEvent.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, username: true, telegramUsername: true }
        }
      }
    });

    const enriched = allParticipants.map((p) => {
      // Prioritize identifying the user (some fields might be null)
      const name = p.user.firstName 
        ? `${p.user.firstName} ${p.user.lastName || ''}`.trim()
        : p.user.username || p.user.telegramUsername || 'Anonymous';
        
      return {
        userId: p.userId,
        name,
        score: Number(p.performanceScore) + (Number(p.depositScore) / 10),
        isWinner: p.isWinner,
        rewardAmount: Number(p.rewardAmount) || 0
      };
    });

    // Sort by calculated score descending
    enriched.sort((a, b) => b.score - a.score);

    // Return top 15 with assigned ranks so they can see themselves if they are close
    return enriched.slice(0, 15).map((p, index) => ({
      ...p,
      rank: index + 1
    }));
  },

  /**
   * Admin triggered endpoint to close the event and distribute tiered rewards.
   */
  async distributeRewards(adminId: string) {
    const activeEvent = await prisma.weeklyRewardEvent.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeEvent) {
      throw new Error('No active event found');
    }

    const leaderboard = await this.getLeaderboard();
    const rewardTiers = await getBlastRewardTiers();
    const eventName = await getBlastEventName();

    await prisma.$transaction(async (tx) => {
      let winnersCount = 0;
      
      // Distribute rewards to top players based on reward tiers array
      for (let i = 0; i < Math.min(leaderboard.length, rewardTiers.length); i++) {
        const player = leaderboard[i];
        const rewardAmount = rewardTiers[i];
        
        if (rewardAmount > 0) {
          // Update Participant record
          await tx.weeklyRewardParticipant.updateMany({
            where: { eventId: activeEvent.id, userId: player.userId },
            data: { isWinner: true, rewardAmount },
          });

          // Update Wallet
          const wallet = await tx.wallet.update({
            where: { userId: player.userId },
            data: { balance: { increment: rewardAmount } },
          });

          // Log Transaction
          await tx.transaction.create({
            data: {
              userId: player.userId,
              type: 'WEEKLY_BLAST_REWARD',
              amount: rewardAmount,
              balanceBefore: Number(wallet.balance) - rewardAmount,
              balanceAfter: wallet.balance,
              status: 'completed',
              description: `${eventName} (Rank ${player.rank}) Win`,
            },
          });
          
          winnersCount++;
        }
      }

      // Close the event
      await tx.weeklyRewardEvent.update({
        where: { id: activeEvent.id },
        data: { 
          status: 'CLOSED', 
          closedAt: new Date(),
          totalWinners: winnersCount
        },
      });

      // Log admin action
      await tx.adminLog.create({
        data: {
          adminId,
          targetUserId: adminId, // self target
          action: 'DISTRIBUTE_EVENT_REWARDS',
          details: { eventId: activeEvent.id, winnersCount, eventName },
        }
      });
      
      // Auto-create next event
      await tx.weeklyRewardEvent.create({
        data: {
          status: 'OPEN',
          totalWinners: 0,
        },
      });
    });

    return { success: true };
  }
};
