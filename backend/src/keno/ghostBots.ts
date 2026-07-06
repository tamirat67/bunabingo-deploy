import { randomUUID } from 'crypto';

/* ═══════════════════════════════════════════════════════════════════
   ETHIOPIAN NAMES POOL — 70 authentic Ethiopian first names
═══════════════════════════════════════════════════════════════════ */
const ETHIOPIAN_NAMES = [
  'Abebe', 'Kebede', 'Tigist', 'Meron', 'Selam', 'Yonas', 'Biruk', 'Hana',
  'Dawit', 'Liya', 'Samuel', 'Rahel', 'Michael', 'Sara', 'Daniel', 'Bethlehem',
  'Tsehay', 'Getnet', 'Eyob', 'Miriam', 'Henok', 'Feven', 'Abel', 'Kalkidan',
  'Natnael', 'Yordanos', 'Tariku', 'Almaz', 'Tesfaye', 'Selamawit',
  'Berhane', 'Lidya', 'Mezgebe', 'Saron', 'Amanuel', 'Tewodros', 'Muluwork',
  'Sintayehu', 'Dagim', 'Fikirte', 'Zewdu', 'Makda', 'Yared', 'Hiwot',
  'Girma', 'Asegedech', 'Teklu', 'Bezawit', 'Wubet', 'Tsige',
  'Mulugeta', 'Worku', 'Fekade', 'Tadesse', 'Meseret', 'Alemu', 'Fikru',
  'Zerihun', 'Tsehai', 'Belaynesh', 'Sisay', 'Yirgalem', 'Meaza', 'Tigabu',
  'Habtamu', 'Fantahun', 'Genet', 'Aster', 'Mekonnen', 'Zinash',
];

/* ═══════════════════════════════════════════════════════════════════
   STAKE DISTRIBUTION — realistic ETB amounts (10–500 ETB)
   Weighted toward smaller bets to feel like real players
═══════════════════════════════════════════════════════════════════ */
const STAKE_POOL_CENTS = [
  1000, 1000, 1000, 1000,  // 10 ETB (most common)
  1500, 1500, 1500,        // 15 ETB
  2000, 2000, 2000,        // 20 ETB
  2500, 2500,              // 25 ETB
  3000, 3000,              // 30 ETB
  5000, 5000,              // 50 ETB
  10000,                   // 100 ETB
  20000,                   // 200 ETB
  50000,                   // 500 ETB (rare high roller)
];

/* ═══════════════════════════════════════════════════════════════════
   PAYOUT TABLE — mirrors FastKenoBoard.tsx exactly so WON amounts
   look authentic to real players watching the feed
═══════════════════════════════════════════════════════════════════ */
const PAYOUT_TABLE: Record<number, { match: number; mult: number }[]> = {
  1:  [{ match: 1, mult: 2.8 }],
  2:  [{ match: 1, mult: 1 }, { match: 2, mult: 5 }],
  3:  [{ match: 2, mult: 1.5 }, { match: 3, mult: 35 }],
  4:  [{ match: 2, mult: 1 }, { match: 3, mult: 7 }, { match: 4, mult: 60 }],
  5:  [{ match: 3, mult: 3 }, { match: 4, mult: 25 }, { match: 5, mult: 250 }],
  6:  [{ match: 3, mult: 1 }, { match: 4, mult: 11 }, { match: 5, mult: 70 }, { match: 6, mult: 500 }],
  7:  [{ match: 0, mult: 1 }, { match: 3, mult: 1 }, { match: 4, mult: 3 }, { match: 5, mult: 20 }, { match: 6, mult: 100 }, { match: 7, mult: 1000 }],
  8:  [{ match: 0, mult: 1 }, { match: 4, mult: 3 }, { match: 5, mult: 12 }, { match: 6, mult: 40 }, { match: 7, mult: 200 }, { match: 8, mult: 2000 }],
  9:  [{ match: 0, mult: 1 }, { match: 4, mult: 2 }, { match: 5, mult: 6 }, { match: 6, mult: 20 }, { match: 7, mult: 100 }, { match: 8, mult: 1000 }, { match: 9, mult: 5000 }],
  10: [{ match: 0, mult: 1 }, { match: 5, mult: 3 }, { match: 6, mult: 25 }, { match: 7, mult: 100 }, { match: 8, mult: 400 }, { match: 9, mult: 2000 }, { match: 10, mult: 10000 }],
};

/* ═══════════════════════════════════════════════════════════════════
   INTERNAL TYPES
═══════════════════════════════════════════════════════════════════ */
interface GhostTicket {
  id: string;
  username: string;
  picks: number[];
  stakeCents: number;
}

/* ═══════════════════════════════════════════════════════════════════
   GHOST BOT EMITTER
   - Schedules 250–400 fake player entries per BETTING round
   - Settles them (WON/LOST) when the draw completes
   - Never touches the DB or any wallet
═══════════════════════════════════════════════════════════════════ */
export class GhostBotEmitter {
  /** Pending emit timers for current round — cleared on new round start */
  private activeTimers: NodeJS.Timeout[] = [];

  /** roundCode → ghost tickets (needed to settle them after draw) */
  private pendingGhosts = new Map<string, GhostTicket[]>();

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Call this right after a new BETTING round starts.
   * Schedules 250–400 ghost bets to drip into the live feed
   * evenly across the betting window.
   *
   * @param roundCode         The round identifier (used as map key)
   * @param bettingWindowSecs How many seconds the betting window is open
   */
  scheduleForRound(roundCode: string, bettingWindowSecs: number): void {
    this.clearTimers();

    // Random bot count: 250–400
    const botCount = Math.floor(Math.random() * (400 - 250 + 1)) + 250;

    // Generate all ghost tickets upfront
    const ghosts: GhostTicket[] = Array.from({ length: botCount }, () => ({
      id: `ghost_${randomUUID()}`,
      username: this.randomItem(ETHIOPIAN_NAMES),
      picks: this.randomPicks(Math.floor(Math.random() * 10) + 1), // 1–10
      stakeCents: this.randomItem(STAKE_POOL_CENTS),
    }));

    this.pendingGhosts.set(roundCode, ghosts);

    // Spread bets across 90% of the betting window so the last few
    // seconds feel like frantic last-minute activity
    const spreadMs = Math.max(500, bettingWindowSecs * 900);

    ghosts.forEach((ghost) => {
      // Human-like timing: pure uniform random distribution across the entire 
      // betting window. This prevents unnatural clumps and ensures a smooth, 
      // steady stream of bets that looks like independent human players.
      const delay = Math.floor(Math.random() * spreadMs);

      const timer = setTimeout(async () => {
        try {
          const { getIO } = await import('../lib/socket');
          getIO().emit('keno:TICKET_UPDATE', {
            id:         ghost.id,
            userId:     null,          // never matches any real user → isOwn = false
            username:   ghost.username,
            picks:      ghost.picks,
            stakeCents: ghost.stakeCents,
            status:     'PLACED',      // renders as WAITING badge in frontend
          });
        } catch (_) {
          // Non-fatal — socket may not be ready yet on very first round
        }
      }, delay);

      this.activeTimers.push(timer);
    });

    console.log(
      `[GhostBots] Scheduled ${botCount} ghost players for round ${roundCode} ` +
      `over ${bettingWindowSecs}s window`
    );
  }

  /**
   * Call this after the draw completes and real tickets are settled.
   * Emits WON/LOST updates for each ghost using the real payout table.
   *
   * @param roundCode     The round identifier
   * @param drawnNumbers  The 20 numbers drawn this round
   */
  async settleForRound(roundCode: string, drawnNumbers: number[]): Promise<void> {
    const ghosts = this.pendingGhosts.get(roundCode);
    if (!ghosts || ghosts.length === 0) return;

    this.pendingGhosts.delete(roundCode);

    let settled = 0;

    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();

      // Settle all ghosts in small batches (20 per tick) so we don't
      // flood the socket with hundreds of events simultaneously
      const BATCH = 20;
      for (let i = 0; i < ghosts.length; i += BATCH) {
        const batch = ghosts.slice(i, i + BATCH);

        for (const ghost of batch) {
          const hits       = ghost.picks.filter((p) => drawnNumbers.includes(p)).length;
          const mult       = this.getMultiplier(ghost.picks.length, hits);
          const payoutCents = mult > 0 ? Math.floor(ghost.stakeCents * mult) : 0;
          const won        = payoutCents > 0;

          io.emit('keno:TICKET_UPDATE', {
            id:          ghost.id,
            userId:      null,
            username:    ghost.username,
            picks:       ghost.picks,
            stakeCents:  ghost.stakeCents,
            status:      won ? 'WON' : 'LOST',
            hits,
            payoutCents: won ? payoutCents : 0,
          });
          settled++;
        }

        // Tiny pause between batches
        await new Promise((r) => setTimeout(r, 30));
      }
    } catch (_) {}

    console.log(`[GhostBots] Settled ${settled} ghost tickets for round ${roundCode}`);
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /** Cancel all pending emit timers (called on new round start) */
  clearTimers(): void {
    this.activeTimers.forEach((t) => clearTimeout(t));
    this.activeTimers = [];
  }

  /** Pick `count` unique random numbers from 1–80 */
  private randomPicks(count: number): number[] {
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).sort((a, b) => a - b);
  }

  /** Return the payout multiplier for given spotCount + hits */
  private getMultiplier(spotCount: number, hits: number): number {
    const rules = PAYOUT_TABLE[spotCount] ?? [];
    // Find the exact-match rule first
    const exact = rules.find((r) => r.match === hits);
    if (exact) return exact.mult;
    // If no exact match, no payout
    return 0;
  }

  /** Return a random item from an array */
  private randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

/** Singleton instance shared across the app */
export const ghostBotEmitter = new GhostBotEmitter();
