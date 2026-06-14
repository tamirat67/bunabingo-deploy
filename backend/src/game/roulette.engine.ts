import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { triggerSocketGameEvent } from '../lib/socket';
import { Decimal } from '@prisma/client/runtime/library';

export type RouletteStatus = 'BETTING' | 'SPINNING' | 'PAYOUT';

export interface RouletteBet {
  userId: string;
  amount: number;
  betType: string;
  betValue: string;
}

class RouletteEngine {
  public status: RouletteStatus = 'BETTING';
  public secondsRemaining: number = 30;
  public bets: RouletteBet[] = [];
  public history: number[] = [];
  public currentResult: number | null = null;

  private timer: NodeJS.Timeout | null = null;

  public start() {
    this.status = 'BETTING';
    this.secondsRemaining = 30;
    this.bets = [];
    this.currentResult = null;
    
    logger.info('[Roulette] Starting new round. Status: BETTING');
    this.broadcastState();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private async tick() {
    this.secondsRemaining--;

    if (this.status === 'BETTING') {
      if (this.secondsRemaining <= 0) {
        // Transition to SPINNING
        this.status = 'SPINNING';
        this.secondsRemaining = 10;
        
        // Generate result immediately so we can send it to frontend for animation
        this.currentResult = Math.floor(Math.random() * 37); // 0-36
        logger.info(`[Roulette] Betting closed. Spinning... Result will be ${this.currentResult}`);
        
        triggerSocketGameEvent('roulette', 'roulette-spinning', {
          result: this.currentResult,
          secondsRemaining: this.secondsRemaining
        });
      } else {
        // Just broadcast time
        triggerSocketGameEvent('roulette', 'roulette-tick', {
          status: this.status,
          secondsRemaining: this.secondsRemaining
        });
      }
    } 
    else if (this.status === 'SPINNING') {
      if (this.secondsRemaining <= 0) {
        // Transition to PAYOUT
        this.status = 'PAYOUT';
        this.secondsRemaining = 5;
        this.history.unshift(this.currentResult!);
        if (this.history.length > 20) this.history.pop();
        
        logger.info(`[Roulette] Spin finished. Payout phase for result ${this.currentResult}`);
        await this.processPayouts();
        
        triggerSocketGameEvent('roulette', 'roulette-result', {
          result: this.currentResult,
          history: this.history,
          secondsRemaining: this.secondsRemaining
        });
      }
    }
    else if (this.status === 'PAYOUT') {
      if (this.secondsRemaining <= 0) {
        // Restart round
        this.start();
      }
    }
  }

  public async placeBet(userId: string, amount: number, betType: string, betValue: string) {
    if (this.status !== 'BETTING') {
      throw new Error('Betting is closed for this round');
    }
    if (amount <= 0) {
      throw new Error('Invalid bet amount');
    }

    // Deduct from wallet immediately
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error('Wallet not found');

    const totalAvailable = new Decimal(wallet.balance.toString()).add(new Decimal(wallet.bonusBalance.toString()));
    const charge = new Decimal(amount);

    if (totalAvailable.lessThan(charge)) {
      throw new Error('Insufficient balance');
    }

    let remainingToDebit = charge;
    let newBonus = new Decimal(wallet.bonusBalance.toString());
    let newBalance = new Decimal(wallet.balance.toString());

    if (newBonus.greaterThan(0)) {
      const bonusToUse = Decimal.min(newBonus, remainingToDebit);
      newBonus = newBonus.sub(bonusToUse);
      remainingToDebit = remainingToDebit.sub(bonusToUse);
    }

    if (remainingToDebit.greaterThan(0)) {
      newBalance = newBalance.sub(remainingToDebit);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: newBalance,
          bonusBalance: newBonus,
          totalSpent: { increment: charge }
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'GAME_BET',
          amount: charge,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          status: 'COMPLETED',
          description: `Roulette Bet: ${betType} ${betValue} (${amount} ETB)`
        }
      });
    });

    this.bets.push({ userId, amount, betType, betValue });
    
    // Broadcast updated bets to everyone
    triggerSocketGameEvent('roulette', 'roulette-bets-update', {
      bets: this.bets
    });
  }

  private async processPayouts() {
    if (this.currentResult === null) return;
    const winningNumber = this.currentResult;

    // Calculate winners
    const winners = new Map<string, Decimal>(); // userId -> totalWinAmount

    for (const bet of this.bets) {
      const isWin = this.checkWin(bet, winningNumber);
      if (isWin) {
        const payoutMultiplier = this.getPayoutMultiplier(bet.betType);
        const winAmount = new Decimal(bet.amount).mul(payoutMultiplier);
        
        const currentWin = winners.get(bet.userId) || new Decimal(0);
        winners.set(bet.userId, currentWin.add(winAmount));
      }
    }

    // Distribute winnings
    for (const [userId, winAmount] of winners.entries()) {
      try {
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { userId } });
          if (!wallet) return;

          const newBalance = new Decimal(wallet.balance.toString()).add(winAmount);

          await tx.wallet.update({
            where: { userId },
            data: {
              balance: newBalance,
              totalWon: { increment: winAmount }
            }
          });

          await tx.transaction.create({
            data: {
              userId,
              type: 'GAME_WIN',
              amount: winAmount,
              balanceBefore: wallet.balance,
              balanceAfter: newBalance,
              status: 'COMPLETED',
              description: `Roulette Win! Number ${winningNumber} paid out ${winAmount} ETB`
            }
          });
        });
        
        // Notify the specific user they won
        triggerSocketGameEvent('roulette', `roulette-win-${userId}`, {
          amount: winAmount.toNumber(),
          number: winningNumber
        });
        
      } catch (err) {
        logger.error(`[Roulette] Failed to process payout for user ${userId}:`, err);
      }
    }
  }

  private checkWin(bet: RouletteBet, winningNumber: number): boolean {
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

    if (winningNumber === 0 && bet.betType !== 'STRAIGHT') {
      return false; // All outside bets lose on 0
    }

    switch (bet.betType) {
      case 'STRAIGHT':
        return winningNumber === parseInt(bet.betValue);
      case 'COLOR':
        if (bet.betValue === 'RED') return redNumbers.includes(winningNumber);
        if (bet.betValue === 'BLACK') return blackNumbers.includes(winningNumber);
        return false;
      case 'EVEN_ODD':
        if (bet.betValue === 'EVEN') return winningNumber % 2 === 0;
        if (bet.betValue === 'ODD') return winningNumber % 2 !== 0;
        return false;
      case 'HIGH_LOW':
        if (bet.betValue === 'LOW') return winningNumber >= 1 && winningNumber <= 18;
        if (bet.betValue === 'HIGH') return winningNumber >= 19 && winningNumber <= 36;
        return false;
      case 'DOZEN':
        if (bet.betValue === '1ST') return winningNumber >= 1 && winningNumber <= 12;
        if (bet.betValue === '2ND') return winningNumber >= 13 && winningNumber <= 24;
        if (bet.betValue === '3RD') return winningNumber >= 25 && winningNumber <= 36;
        return false;
      case 'COLUMN':
        if (bet.betValue === '1ST') return winningNumber % 3 === 1;
        if (bet.betValue === '2ND') return winningNumber % 3 === 2;
        if (bet.betValue === '3RD') return winningNumber % 3 === 0;
        return false;
      default:
        return false;
    }
  }

  private getPayoutMultiplier(betType: string): number {
    switch (betType) {
      case 'STRAIGHT': return 36; // 35:1 means they get their original bet back + 35
      case 'DOZEN': return 3; // 2:1 -> 3
      case 'COLUMN': return 3; // 2:1 -> 3
      case 'COLOR': return 2; // 1:1 -> 2
      case 'EVEN_ODD': return 2; // 1:1 -> 2
      case 'HIGH_LOW': return 2; // 1:1 -> 2
      default: return 0;
    }
  }

  public broadcastState() {
    triggerSocketGameEvent('roulette', 'roulette-state', {
      status: this.status,
      secondsRemaining: this.secondsRemaining,
      bets: this.bets,
      history: this.history,
      currentResult: this.currentResult
    });
  }
}

export const rouletteEngine = new RouletteEngine();
