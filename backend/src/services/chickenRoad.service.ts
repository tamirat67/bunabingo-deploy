/**
 * ═══════════════════════════════════════════════════════
 *  CHICKEN ROAD — SECURE GAME SERVICE
 * ═══════════════════════════════════════════════════════
 *
 * Implements provably fair RNG logic and strict server-side
 * wallet mutations for the Chicken Road mini-game.
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { triggerUserEvent } from '../lib/pusher';

export const CHICKEN_TIERS = {
  // ── PHASE 1: SAFE LAUNCH (company-protected) ────────────────
  // Toggled ON from admin settings panel. Use for first deploy.
  phase1: {
    easy:    { successRate: 0.75, houseEdge: 0.96 }, // 25 red balls — ~25% company profit/step
    medium:  { successRate: 0.65, houseEdge: 0.95 }, // 35 red balls — ~35% company profit/step
    hard:    { successRate: 0.55, houseEdge: 0.94 }, // 45 red balls — ~45% company profit/step
    extreme: { successRate: 0.45, houseEdge: 0.75 }, // 55 red balls — ~55% company profit/step
  },
  // ── PHASE 2: PLAYER-FRIENDLY (restore when ready) ──────────
  // Switch to this once your player base grows via admin settings.
  phase2: {
    easy:    { successRate: 0.95, houseEdge: 0.96 }, //  5 red balls — ~4% company profit/step
    medium:  { successRate: 0.90, houseEdge: 0.95 }, // 10 red balls — ~5% company profit/step
    hard:    { successRate: 0.85, houseEdge: 0.94 }, // 15 red balls — ~6% company profit/step
    extreme: { successRate: 0.65, houseEdge: 0.75 }, // 35 red balls — ~25% company profit/step
  },
};

export const CHICKEN_CONFIG = {
  minBet:  10,
  maxBet:  5000,
  betStep: 10,
  maxMultiplier: 10000,
  // Active tiers are loaded dynamically in resolveStep via DB chickenRoadMode
};

type TierKey = 'easy' | 'medium' | 'hard' | 'extreme';

/** Load the currently active tier config from admin settings in DB */
async function getActiveTiers() {
  const hs = await prisma.houseSettings.findUnique({ where: { id: 1 } });
  const mode = hs?.chickenRoadMode ?? 1;
  return mode === 2 ? CHICKEN_TIERS.phase2 : CHICKEN_TIERS.phase1;
}

// ── RNG helpers ───────────────────────────────────────────────────────────────

function generateSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/** Deterministic float [0,1) from serverSeed+clientSeed+nonce */
function seededRandom(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  const val = parseInt(hash.slice(0, 8), 16);
  return val / 0xffffffff;
}

// ── Wallet balance helper ─────────────────────────────────────────────────────

function totalBalance(wallet: { balance: Decimal; bonusBalance: Decimal }): number {
  return parseFloat(
    new Decimal(wallet.balance?.toString() ?? '0')
      .add(new Decimal(wallet.bonusBalance?.toString() ?? '0'))
      .toFixed(2),
  );
}

// ── Service Methods ───────────────────────────────────────────────────────────

export async function startRound(userId: string, betAmount: number, tier: TierKey, clientSeed?: string) {
  if (betAmount < CHICKEN_CONFIG.minBet || betAmount > CHICKEN_CONFIG.maxBet) {
    throw new Error(`Bet must be between ${CHICKEN_CONFIG.minBet} and ${CHICKEN_CONFIG.maxBet} ETB`);
  }
  if (!CHICKEN_CONFIG.tiers[tier]) {
    throw new Error('Invalid tier selected');
  }

  const serverSeed = generateSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const resolvedClient = clientSeed || crypto.randomBytes(4).toString('hex');

  // Transaction: deduct bet and create game record
  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error('Wallet not found');

    const dBet = new Decimal(betAmount);
    if (wallet.balance.add(wallet.bonusBalance).lt(dBet)) {
      throw new Error('Insufficient balance');
    }

    // Deduct bonus first, then real balance
    let deductBonus = new Decimal(0);
    let deductReal  = new Decimal(0);
    if (wallet.bonusBalance.gte(dBet)) {
      deductBonus = dBet;
    } else {
      deductBonus = wallet.bonusBalance;
      deductReal  = dBet.sub(wallet.bonusBalance);
    }

    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: {
        bonusBalance: { decrement: deductBonus },
        balance: { decrement: deductReal },
        totalSpent: { increment: dBet },
      },
    });

    const game = await tx.chickenRoadGame.create({
      data: {
        userId,
        betAmount: dBet,
        tier,
        status: 'PLAYING',
        steps: 0,
        multiplier: 1.0,
        winAmount: 0,
        serverSeed,
        serverSeedHash,
        clientSeed: resolvedClient,
        nonce: 0,
      }
    });

    return {
      roundId: game.id,
      serverSeedHash,
      clientSeed: resolvedClient,
      nonce: 0,
      newBalance: totalBalance(updatedWallet),
    };
  });
}

export async function resolveStep(userId: string, roundId: string) {
  // Load active tier config from DB (reflects admin phase toggle instantly)
  const activeTiers = await getActiveTiers();

  return await prisma.$transaction(async (tx) => {
    const game = await tx.chickenRoadGame.findUnique({ where: { id: roundId } });
    if (!game) throw new Error('Game not found');
    if (game.userId !== userId) throw new Error('Unauthorized');
    if (game.status !== 'PLAYING') throw new Error(`Game already ${game.status}`);
    if (Number(game.multiplier) >= CHICKEN_CONFIG.maxMultiplier) {
      throw new Error(`Maximum multiplier of ${CHICKEN_CONFIG.maxMultiplier}x reached. Please cash out!`);
    }

    const newNonce = game.nonce + 1;
    const rng = seededRandom(game.serverSeed, game.clientSeed, newNonce);
    const tierConfig = activeTiers[game.tier as TierKey];

    const isSafe = rng < tierConfig.successRate;

    if (isSafe) {
      const growthPerStep = (1 / tierConfig.successRate) * tierConfig.houseEdge;
      let nextMultiplier = Number(game.multiplier) * growthPerStep;

      // Cap at maximum allowed multiplier
      if (nextMultiplier > CHICKEN_CONFIG.maxMultiplier) {
        nextMultiplier = CHICKEN_CONFIG.maxMultiplier;
      }

      await tx.chickenRoadGame.update({
        where: { id: roundId },
        data: {
          nonce: newNonce,
          steps: game.steps + 1,
          multiplier: nextMultiplier
        }
      });

      return { safe: true, nextMultiplier };
    } else {
      // Bust
      await tx.chickenRoadGame.update({
        where: { id: roundId },
        data: {
          nonce: newNonce,
          steps: game.steps + 1,
          status: 'BUST'
        }
      });
      return { safe: false, nextMultiplier: 0, serverSeed: game.serverSeed };
    }
  });
}

export async function cashoutRound(userId: string, roundId: string) {
  return await prisma.$transaction(async (tx) => {
    const game = await tx.chickenRoadGame.findUnique({ where: { id: roundId } });
    if (!game) throw new Error('Game not found');
    if (game.userId !== userId) throw new Error('Unauthorized');
    if (game.status !== 'PLAYING') throw new Error(`Game already ${game.status}`);
    if (game.steps === 0) throw new Error('Must complete at least 1 step to cash out');

    const winAmount = new Decimal(game.betAmount).mul(game.multiplier);

    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: {
        balance: { increment: winAmount },
        totalWon: { increment: winAmount },
      },
    });

    await tx.chickenRoadGame.update({
      where: { id: roundId },
      data: {
        status: 'WON',
        winAmount
      }
    });

    return {
      winAmount: Number(winAmount),
      multiplier: Number(game.multiplier),
      newBalance: totalBalance(updatedWallet),
      serverSeed: game.serverSeed
    };
  });
}
