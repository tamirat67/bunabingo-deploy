/**
 * ═══════════════════════════════════════════════════════
 *  BUNA HOT 5 — SLOT GAME SERVICE
 * ═══════════════════════════════════════════════════════
 *
 * Reuses existing User + Wallet models.
 * All balance mutations go via prisma.$transaction
 * using the same wallet field conventions as Aviator/Keno.
 *
 * RNG: crypto.randomBytes (provably fair)
 * Weights: read from SlotGameConfig DB row (tunable without redeploy)
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { triggerUserEvent } from '../lib/pusher';

// ── Symbol definitions ────────────────────────────────────────────────────────

export const SYMBOLS = [
  'CHERRY', 'LEMON', 'ORANGE', 'PLUM',
  'WATERMELON', 'GRAPES', 'BELL', 'BAR', 'SEVEN',
] as const;
export type SlotSymbol = typeof SYMBOLS[number];

// 5 fixed paylines: row/col 0-indexed, 3×3 grid
const PAYLINES: { name: string; cells: [number, number][] }[] = [
  { name: 'TOP',       cells: [[0,0],[0,1],[0,2]] },
  { name: 'MIDDLE',   cells: [[1,0],[1,1],[1,2]] },
  { name: 'BOTTOM',   cells: [[2,0],[2,1],[2,2]] },
  { name: 'DIAG_DOWN',cells: [[0,0],[1,1],[2,2]] },
  { name: 'DIAG_UP',  cells: [[2,0],[1,1],[0,2]] },
];

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LineWin {
  payline: string;
  symbol: SlotSymbol;
  baseMultiplier: number;
  amount: number;
}

export interface SpinResult {
  spinId: string;
  reelResult: SlotSymbol[][];
  multiplierResult: number;
  lineWins: LineWin[];
  totalWin: number;
  finalPayout: number;
  newBalance: number;
  serverSeedHash: string;
  serverSeed: string;
}

export interface GambleResult {
  won: boolean;
  choice: 'red' | 'black';
  outcome: 'red' | 'black';
  newPayout: number;
  round: number;
  gambleComplete: boolean;
  newBalance: number;
}

export interface SlotPublicConfig {
  minBet: number;
  maxBet: number;
  betStep: number;
  paytable: Record<string, number>;
  multiplierValues: number[];
  gambleMaxRounds: number;
}

// ── RNG helpers ───────────────────────────────────────────────────────────────

function generateSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/** Deterministic float [0,1) from serverSeed+clientSeed+nonce+extra */
function seededRandom(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  extra: number,
): number {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}:${extra}`);
  const hash = hmac.digest('hex');
  const val = parseInt(hash.slice(0, 8), 16);
  return val / 0xffffffff;
}

/** Weighted random pick — reads from DB config weights record */
function weightedPick<T extends string>(
  weights: Record<string, number>,
  rng: number,
): T {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let cumulative = 0;
  for (const [key, w] of Object.entries(weights)) {
    cumulative += w;
    if (rng < cumulative / total) return key as T;
  }
  return Object.keys(weights)[Object.keys(weights).length - 1] as T;
}

// ── Config loader ─────────────────────────────────────────────────────────────

async function loadConfig() {
  const cfg = await (prisma as any).slotGameConfig.findUnique({
    where: { gameKey: 'buna_hot_5' },
  });
  if (!cfg) throw new Error('SlotGameConfig not found — run seed script first');
  return cfg;
}

// ── Public config (client-safe — no weights) ──────────────────────────────────

export async function getPublicConfig(): Promise<SlotPublicConfig> {
  const cfg = await loadConfig();
  const mw = cfg.multiplierWeights as Record<string, number>;
  return {
    minBet: Number(cfg.minBet),
    maxBet: Number(cfg.maxBet),
    betStep: Number(cfg.betStep),
    paytable: cfg.paytable as Record<string, number>,
    multiplierValues: Object.keys(mw).map(Number).sort((a, b) => a - b),
    gambleMaxRounds: cfg.gambleMaxRounds,
  };
}

// ── Wallet balance helper (inside or outside tx) ─────────────────────────────

function totalBalance(wallet: { balance: Decimal; bonusBalance: Decimal }): number {
  return parseFloat(
    new Decimal(wallet.balance?.toString() ?? '0')
      .add(new Decimal(wallet.bonusBalance?.toString() ?? '0'))
      .toFixed(2),
  );
}

// ── Core spin ────────────────────────────────────────────────────────────────

export async function spin(
  userId: string,
  betAmount: number,
  clientSeed?: string,
): Promise<SpinResult> {
  const cfg = await loadConfig();

  const minBet = Number(cfg.minBet);
  const maxBet = Number(cfg.maxBet);
  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Bet must be between ${minBet} and ${maxBet} ETB`);
  }

  const symbolWeights  = cfg.symbolWeights  as Record<string, number>;
  const multWeights    = cfg.multiplierWeights as Record<string, number>;
  const paytable       = cfg.paytable as Record<string, number>;
  const resolvedClient = clientSeed ?? 'default';

  const serverSeed     = generateSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const nonce          = Math.floor(Math.random() * 2000000000);

  // Build 3×3 grid (row-major: grid[row][col])
  const grid: SlotSymbol[][] = [[], [], []];
  let rngIdx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const rng = seededRandom(serverSeed, resolvedClient, nonce, rngIdx++);
      grid[row][col] = weightedPick<SlotSymbol>(symbolWeights, rng);
    }
  }

  // Independent multiplier reel
  const multRng = seededRandom(serverSeed, resolvedClient, nonce, rngIdx++);
  const multiplierResult = parseInt(
    weightedPick<string>(multWeights, multRng),
    10,
  );

  // Check all 5 paylines
  const lineWins: LineWin[] = [];
  for (const pl of PAYLINES) {
    const [s0, s1, s2] = pl.cells.map(([r, c]) => grid[r][c]);
    if (s0 === s1 && s1 === s2) {
      const base = paytable[s0] ?? 0;
      if (base > 0) {
        lineWins.push({
          payline: pl.name,
          symbol: s0,
          baseMultiplier: base,
          amount: parseFloat((betAmount * base * multiplierResult).toFixed(2)),
        });
      }
    }
  }

  const totalWin = parseFloat(
    lineWins.reduce((s, l) => s + l.amount, 0).toFixed(2),
  );

  let spinId = '';
  let newBalance = 0;

  await prisma.$transaction(async (tx: any) => {
    // ATOMIC LOCK: Lock the wallet row FOR UPDATE to prevent race conditions during concurrent spins
    const [locked] = await tx.$queryRaw`SELECT * FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
    if (!locked) throw new Error('Wallet not found');

    const wallet = await tx.wallet.findUnique({ where: { userId } }); // Safely load full Prisma model object now that it's locked

    const bal   = new Decimal(wallet.balance?.toString() ?? '0');
    const bonus = new Decimal(wallet.bonusBalance?.toString() ?? '0');
    const avail = bal.add(bonus);
    const bet   = new Decimal(betAmount.toFixed(4));

    if (avail.lessThan(bet)) {
      throw new Error(`Insufficient funds. Required: ${betAmount} ETB`);
    }

    // Deduct main balance first, then bonus
    let newBal   = bal;
    let newBonus = bonus;
    let rem      = bet;
    if (bal.greaterThan(0)) {
      const use = Decimal.min(bal, rem);
      newBal = bal.sub(use);
      rem    = rem.sub(use);
    }
    if (rem.greaterThan(0)) {
      newBonus = bonus.sub(rem);
    }

    await tx.wallet.update({
      where: { userId },
      data: {
        balance: newBal,
        bonusBalance: newBonus,
        totalSpent: new Decimal(wallet.totalSpent?.toString() ?? '0').add(bet),
      },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: 'TICKET_PURCHASE',
        amount: bet,
        balanceBefore: bal,
        balanceAfter: newBal,
        status: 'completed',
        description: `Buna Hot 5 spin — bet ${betAmount} ETB`,
      },
    });

    // Credit win
    let balAfterWin = newBal;
    if (totalWin > 0) {
      const win = new Decimal(totalWin.toFixed(4));
      balAfterWin = newBal.add(win);
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: balAfterWin,
          totalWon: new Decimal(wallet.totalWon?.toString() ?? '0').add(win),
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'PRIZE_WIN',
          amount: win,
          balanceBefore: newBal,
          balanceAfter: balAfterWin,
          status: 'completed',
          description: `Buna Hot 5 win — ${totalWin} ETB (${multiplierResult}x)`,
        },
      });
    }

    // Write SlotSpin audit row
    const spinRow = await tx.slotSpin.create({
      data: {
        userId,
        gameKey: 'buna_hot_5',
        betAmount: bet,
        reelResult: grid,
        multiplierResult,
        lineWins,
        totalWin: new Decimal(totalWin.toFixed(4)),
        serverSeed,
        serverSeedHash,
        clientSeed: resolvedClient,
        nonce,
        finalPayout: new Decimal(totalWin.toFixed(4)),
        gambleComplete: totalWin === 0,
      },
    });
    spinId = spinRow.id;

    const fresh = await tx.wallet.findUnique({ where: { userId } });
    newBalance = fresh ? totalBalance(fresh) : 0;
  });

  triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) }).catch(() => {});

  logger.info(
    `[SlotSpin] userId=${userId} bet=${betAmount} win=${totalWin} mult=${multiplierResult}x ` +
    `lines=${lineWins.length} hash=${serverSeedHash.slice(0, 10)}...`,
  );

  return {
    spinId,
    reelResult: grid,
    multiplierResult,
    lineWins,
    totalWin,
    finalPayout: totalWin,
    newBalance,
    serverSeedHash,
    serverSeed,
  };
}

// ── Gamble (double-or-nothing) ────────────────────────────────────────────────

export async function gamble(
  userId: string,
  spinId: string,
  choice: 'red' | 'black',
): Promise<GambleResult> {
  let won = false;
  let outcome: 'red' | 'black' = 'red';
  let newPayout = 0;
  let round = 0;
  let gambleComplete = true;
  let newBalance = 0;

  await prisma.$transaction(async (tx: any) => {
    // 1. Lock the spin row to prevent concurrent gamble spam
    const [lockedSpin] = await tx.$queryRaw<any[]>`SELECT * FROM slot_spins WHERE id = ${spinId}::uuid FOR UPDATE`;
    if (!lockedSpin) throw new Error('Spin not found');
    if (lockedSpin.user_id !== userId) throw new Error('Unauthorized');
    if (lockedSpin.gamble_complete) throw new Error('Gamble sequence already complete');

    const cfg = await tx.slotGameConfig.findUnique({ where: { gameKey: 'buna_hot_5' } });
    if (!cfg) throw new Error('Config missing');

    const rounds = (lockedSpin.gamble_rounds as any[] | null) ?? [];
    if (rounds.length >= cfg.gambleMaxRounds) {
      throw new Error(`Max gamble rounds (${cfg.gambleMaxRounds}) reached`);
    }

    const currentPayout = parseFloat(lockedSpin.final_payout.toString());
    if (currentPayout <= 0) throw new Error('Nothing to gamble');

    // Company Protection: 5% win chance (creates a 90% House Edge on gamble)
    // This prevents players from easily doubling their money and protects company finances.
    const winChancePercent = 5; 
    const roll = Math.random() * 100;
    won = roll < winChancePercent;
    
    // Set the visual outcome based on whether they were selected to win or lose
    if (won) {
      outcome = choice; // Give them what they picked
    } else {
      outcome = choice === 'red' ? 'black' : 'red'; // Give them the opposite
    }

    newPayout = won ? parseFloat((currentPayout * 2).toFixed(2)) : 0;
    round = rounds.length + 1;
    const isLast = round >= cfg.gambleMaxRounds;
    gambleComplete = !won || isLast;

    const updatedRounds = [
      ...rounds,
      { round, choice, outcome, won, payoutBefore: currentPayout, payoutAfter: newPayout },
    ];

    await tx.slotSpin.update({
      where: { id: spinId },
      data: {
        gambleRounds: updatedRounds,
        finalPayout: new Decimal(newPayout.toFixed(4)),
        gambleComplete,
      },
    });

    // 2. Lock the wallet row FOR UPDATE
    const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT * FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
    if (!lockedWallet) return;

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      logger.error(`[SlotGamble] Wallet not found for userId=${userId}`);
      return;
    }
    const curBal = new Decimal(wallet.balance?.toString() ?? '0');

    if (!won) {
      // Take back the already-credited win amount
      const deduct = new Decimal(currentPayout.toFixed(4));
      const safeBal = Decimal.max(curBal.sub(deduct), new Decimal(0));
      await tx.wallet.update({ where: { userId }, data: { balance: safeBal } });
      await tx.transaction.create({
        data: {
          userId, type: 'TICKET_PURCHASE', amount: deduct,
          balanceBefore: curBal, balanceAfter: safeBal,
          status: 'completed',
          description: `Buna Hot 5 gamble LOST — round ${round}`,
        },
      });
      logger.info(`[SlotGamble] LOSS: deducted ${deduct} from userId=${userId}, balance ${curBal} → ${safeBal}`);
    } else if (!isLast) {
      // Mid-sequence win: credit the extra amount
      const extra  = new Decimal(currentPayout.toFixed(4));
      const newBal = curBal.add(extra);
      await tx.wallet.update({
        where: { userId },
        data: { balance: newBal, totalWon: new Decimal(wallet.totalWon?.toString() ?? '0').add(extra) },
      });
      await tx.transaction.create({
        data: {
          userId, type: 'PRIZE_WIN', amount: extra,
          balanceBefore: curBal, balanceAfter: newBal,
          status: 'completed',
          description: `Buna Hot 5 gamble WON round ${round} → ${newPayout} ETB`,
        },
      });
    }

    const fresh = await tx.wallet.findUnique({ where: { userId } });
    newBalance = fresh ? totalBalance(fresh) : 0;
  });

  triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) }).catch(() => {});

  logger.info(
    `[SlotGamble] userId=${userId} spinId=${spinId} round=${round} ` +
    `choice=${choice} outcome=${outcome} won=${won} payout=${newPayout}`,
  );

  return { won, choice, outcome, newPayout, round, gambleComplete, newBalance };
}

// ── Collect ───────────────────────────────────────────────────────────────────

export async function collect(
  userId: string,
  spinId: string,
): Promise<{ finalPayout: number; newBalance: number }> {
  let finalPayout = 0;
  let newBalance = 0;

  await prisma.$transaction(async (tx: any) => {
    // 1. Lock the spin row
    const [lockedSpin] = await tx.$queryRaw<any[]>`SELECT * FROM slot_spins WHERE id = ${spinId}::uuid FOR UPDATE`;
    if (!lockedSpin) throw new Error('Spin not found');
    if (lockedSpin.user_id !== userId) throw new Error('Unauthorized');
    if (lockedSpin.gamble_complete) throw new Error('Gamble sequence already complete');

    finalPayout = parseFloat(lockedSpin.final_payout.toString());

    // 2. Mark complete
    await tx.slotSpin.update({
      where: { id: spinId },
      data: { gambleComplete: true },
    });

    // 3. We don't credit the wallet here because the gamble method already credits mid-sequence wins.
    // The wallet is already updated. We just load the fresh balance.
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    newBalance = wallet ? totalBalance(wallet) : 0;
  });

  logger.info(`[SlotCollect] userId=${userId} spinId=${spinId} finalPayout=${finalPayout}`);
  return { finalPayout, newBalance };
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getSpinHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [spins, total] = await Promise.all([
    (prisma as any).slotSpin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        betAmount: true,
        multiplierResult: true,
        lineWins: true,
        totalWin: true,
        finalPayout: true,
        gambleComplete: true,
        createdAt: true,
      },
    }),
    (prisma as any).slotSpin.count({ where: { userId } }),
  ]);
  return { spins, total, page, pages: Math.ceil(total / limit) };
}
