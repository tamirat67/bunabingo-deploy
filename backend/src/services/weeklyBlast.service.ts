import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
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

    return {
      active: true,
      eventId: activeEvent.id,
      totalWinners: activeEvent.totalWinners,
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

      // 3. Calculate score & probability
      const { depositScore, performanceScore, totalWeight } = await this.calculateScore(userId);
      
      // We want to combine random chance + engagement.
      // Base probability: 5% chance. Weight increases it slightly.
      // Max probability cap at 50% to ensure it's still random.
      let probability = 0.05 + (totalWeight * 0.001); 
      if (probability > 0.5) probability = 0.5;

      const randomVal = Math.random();
      const isWinner = randomVal < probability && activeEvent.totalWinners < 10;

      // 4. Create participant record
      const participant = await tx.weeklyRewardParticipant.create({
        data: {
          eventId: activeEvent.id,
          userId,
          isWinner,
          rewardAmount: isWinner ? 500 : 0,
          depositScore,
          performanceScore,
        },
      });

      // 5. Handle win logic
      if (isWinner) {
        // Update wallet
        const wallet = await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: 500 } },
        });

        // Log transaction
        await tx.transaction.create({
          data: {
            userId,
            type: 'WEEKLY_BLAST_REWARD',
            amount: 500,
            balanceBefore: Number(wallet.balance) - 500,
            balanceAfter: wallet.balance,
            status: 'completed',
            description: 'ሳምንታዊ ሽልማት ፍንዳታ (Weekly Reward Blast) Win',
          },
        });

        // Increment event total winners
        const updatedEvent = await tx.weeklyRewardEvent.update({
          where: { id: activeEvent.id },
          data: { totalWinners: { increment: 1 } },
        });

        // If 10 winners reached, close event
        if (updatedEvent.totalWinners >= 10) {
          await tx.weeklyRewardEvent.update({
            where: { id: activeEvent.id },
            data: { status: 'CLOSED', closedAt: new Date() },
          });
        }
      }

      return {
        isWinner,
        amount: isWinner ? 500 : 0,
        totalWinners: activeEvent.totalWinners + (isWinner ? 1 : 0),
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

    const topParticipants = await prisma.weeklyRewardParticipant.findMany({
      where: { eventId: activeEvent.id },
      orderBy: [
        { performanceScore: 'desc' },
        { depositScore: 'desc' },
      ],
      take: 10,
      include: {
        user: {
          select: { firstName: true, lastName: true, username: true, telegramUsername: true }
        }
      }
    });

    return topParticipants.map((p, index) => {
      // Prioritize identifying the user (some fields might be null)
      const name = p.user.firstName 
        ? `${p.user.firstName} ${p.user.lastName || ''}`.trim()
        : p.user.username || p.user.telegramUsername || 'Anonymous';
        
      return {
        rank: index + 1,
        name,
        score: Number(p.performanceScore) + (Number(p.depositScore) / 10),
        isWinner: p.isWinner
      };
    });
  }
};
