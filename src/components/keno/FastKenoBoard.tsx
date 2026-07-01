'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type RoundPhase = 'IDLE' | 'BETTING' | 'BETTING_CLOSED' | 'DRAWING' | 'COMPLETED';
type MainTab = 'GAME' | 'HISTORY' | 'RESULTS' | 'STATISTICS' | 'LEADERS';
type SubTab = 'ALL' | 'MY_TICKETS' | 'MY_BETS';

interface RoundState {
  roundCode: string;
  phase: RoundPhase;
  secondsRemaining: number;
  drawnNumbers: number[];
  serverSeedHash: string;
  serverSeed?: string;
}

interface LiveTicket {
  id: string;
  username: string;
  picks: number[];
  stakeCents: number;
  status: 'WAITING' | 'WON' | 'LOST' | 'PLACED';
  hits?: number;
  payoutCents?: number;
  isOwn?: boolean;
}

interface HistoryRound {
  roundCode: string;
  drawnNumbers: number[];
  drawnAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════════ */
const MAX_PICKS = 10;
const TOTAL_DRAW = 20;
const DEFAULT_STAKE = 10; // ETB
const STAKE_STEP = 1;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

// Payout multipliers per spot count — matches backend payoutEngine.ts shares
const PAYOUT_TABLE: Record<number, { match: number; mult: number }[]> = {
  1: [{ match: 1, mult: 3 }],
  2: [{ match: 2, mult: 10 }],
  3: [{ match: 2, mult: 1 }, { match: 3, mult: 30 }],
  4: [{ match: 2, mult: 1 }, { match: 3, mult: 3 }, { match: 4, mult: 80 }],
  5: [{ match: 3, mult: 1 }, { match: 4, mult: 10 }, { match: 5, mult: 600 }],
  6: [{ match: 3, mult: 1 }, { match: 4, mult: 3 }, { match: 5, mult: 70 }, { match: 6, mult: 1200 }],
  7: [{ match: 4, mult: 1 }, { match: 5, mult: 15 }, { match: 6, mult: 300 }, { match: 7, mult: 4000 }],
  8: [{ match: 5, mult: 8 }, { match: 6, mult: 60 }, { match: 7, mult: 1200 }, { match: 8, mult: 8000 }],
  9: [{ match: 5, mult: 3 }, { match: 6, mult: 30 }, { match: 7, mult: 320 }, { match: 8, mult: 2000 }, { match: 9, mult: 15000 }],
  10: [{ match: 5, mult: 1 }, { match: 6, mult: 15 }, { match: 7, mult: 60 }, { match: 8, mult: 500 }, { match: 9, mult: 3000 }, { match: 10, mult: 40000 }],
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function maskName(name: string): string {
  if (!name || name.length < 2) return name;
  return name[0] + '***' + name[name.length - 1];
}

function fmtClock(s: number): string {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtETB(cents: number): number {
  return Math.round(cents / 100);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function FastKenoBoard({
  userId,
  balance = 0,
}: {
  userId: string;
  balance?: number;
}) {
  /* ── phase & round ── */
  const [phase, setPhase] = useState<RoundPhase>('IDLE');
  const [round, setRound] = useState<RoundState | null>(null);

  /* ── splash & balance ── */
  const [showSplash, setShowSplash] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [localBalance, setLocalBalance] = useState(balance);

  /* ── picks & betting ── */
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [spotChoice, setSpotChoice] = useState<number | null>(null);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [ticketPlaced, setTicketPlaced] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  /* ── smooth local countdown ── */
  const [localSecondsLeft, setLocalSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── drawing animation ── */
  const [latestBall, setLatestBall] = useState<number | null>(null);
  const [animBalls, setAnimBalls] = useState<Set<number>>(new Set());
  const [bigBallVisible, setBigBallVisible] = useState(false);

  /* ── tabs ── */
  const [mainTab, setMainTab] = useState<MainTab>('GAME');
  const [subTab, setSubTab] = useState<SubTab>('ALL');

  /* ── live data ── */
  const [liveTickets, setLiveTickets] = useState<LiveTicket[]>([]);
  const [historyRounds, setHistoryRounds] = useState<HistoryRound[]>([]);
  const [hotNumbers, setHotNumbers] = useState<number[]>([]);
  const [coldNumbers, setColdNumbers] = useState<number[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  /* ── refs ── */
  const socketRef = useRef<any | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDrawn = useRef<number[]>([]);
  const currentRoundCode = useRef<string | null>(null);

  /* ─────────── helpers ─────────── */
  function showMsg(text: string, ok: boolean) {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg({ text, ok });
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  }

  /* ─────────── Socket.io (Keno real-time) ─────────── */
  const connectSocket = useCallback(() => {
    // Dynamically import socket.io-client to avoid SSR issues
    import('socket.io-client').then(({ io }) => {
      const socket = io(BACKEND_URL, {
        transports: ['websocket'],
        reconnectionDelay: 3000,
      });
      socketRef.current = socket;

      socket.on('connect', () => setWsConnected(true));
      socket.on('disconnect', () => setWsConnected(false));

      socket.on('keno:ROUND_UPDATE', (u: RoundState) => {
        setRound(u);
        setPhase(u.phase as RoundPhase);

        // Sync local countdown to server value
        if (u.phase === 'BETTING') {
          setLocalSecondsLeft(u.secondsRemaining);

          // Only reset picks/tickets when a BRAND NEW round starts (roundCode changes)
          if (currentRoundCode.current !== u.roundCode) {
            currentRoundCode.current = u.roundCode;
            setTicketPlaced(false);
            setPicks(new Set());
            setLiveTickets([]);
            prevDrawn.current = [];
            setLatestBall(null);
            setBigBallVisible(false);
            // Fetch latest balance on new round (catches wins from prior round)
            api.get('/me').then(res => {
              if (res.data?.wallet?.balance) {
                setLocalBalance(Number(res.data.wallet.balance));
              }
            }).catch(() => {});
          }
        } else {
          // DRAWING or COMPLETED — stop countdown
          setLocalSecondsLeft(0);
        }

        // New ball animation
        const newBalls = u.drawnNumbers.filter(
          (n) => !prevDrawn.current.includes(n)
        );
        if (newBalls.length > 0) {
          const newest = newBalls[newBalls.length - 1];
          setLatestBall(newest);
          setBigBallVisible(false);
          setTimeout(() => setBigBallVisible(true), 30);
          setAnimBalls(new Set(newBalls));
          setTimeout(() => setAnimBalls(new Set()), 700);
        }
        prevDrawn.current = u.drawnNumbers;
      });

      socket.on('keno:TICKET_UPDATE', (t: LiveTicket) => {
        setLiveTickets((prev) => {
          const idx = prev.findIndex((x) => x.id === t.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = t;
            return next;
          }
          return [t, ...prev];
        });
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Local 1s countdown tick for smooth timer display
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (phase === 'BETTING' && localSecondsLeft > 0) {
      countdownRef.current = setInterval(() => {
        setLocalSecondsLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [phase, localSecondsLeft > 0 ? 'running' : 'stopped']);

  useEffect(() => {
    connectSocket();
    // Fetch current round immediately on mount (before socket update arrives)
    api.get('/keno/round/current').then(r => {
      if (r.data?.roundCode) {
        const phase = (r.data.phase ?? r.data.status ?? 'BETTING') as RoundPhase;
        const secs = r.data.secondsRemaining ?? 0;
        setRound({ ...r.data, phase, drawnNumbers: r.data.drawnNumbers ?? [], secondsRemaining: secs });
        setPhase(phase);
        setLocalSecondsLeft(secs);
        currentRoundCode.current = r.data.roundCode;
      }
    }).catch(() => {});
    return () => {
      socketRef.current?.disconnect();
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [connectSocket]);


  /* ─────────── Tab data fetch ─────────── */
  useEffect(() => {
    if (mainTab === 'STATISTICS') {
      api.get('/keno/analytics/hot-cold')
        .then((r) => r.data)
        .then((d) => {
          if (d.hotNumbers) setHotNumbers(d.hotNumbers);
          if (d.coldNumbers) setColdNumbers(d.coldNumbers);
        })
        .catch(() => {});
    }
    if (mainTab === 'HISTORY') {
      api.get('/keno/analytics/history?limit=25')
        .then((r) => r.data)
        .then((d) => { if (Array.isArray(d)) setHistoryRounds(d); })
        .catch(() => {});
    }
  }, [mainTab]);

  /* ─────────── Pick logic ─────────── */
  function togglePick(n: number) {
    if (phase !== 'BETTING' || ticketPlaced) return;
    const limit = spotChoice ?? MAX_PICKS;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else if (next.size < limit) {
        next.add(n);
      }
      return next;
    });
  }

  function selectSpot(n: number) {
    if (phase !== 'BETTING' || ticketPlaced) return;
    setSpotChoice(n);
    setPicks(new Set());
  }

  function quickPick() {
    if (phase !== 'BETTING' || ticketPlaced) return;
    const limit = spotChoice ?? MAX_PICKS;
    const pool = Array.from({ length: 80 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    setPicks(new Set(pool.slice(0, limit)));
  }

  /* ─────────── Stake logic ─────────── */
  function adjustStake(delta: number) {
    setStake((s) => Math.max(1, s + delta));
  }
  function doubleStake() {
    setStake((s) => Math.min(s * 2, 10000));
  }
  function maxStake() {
    setStake(500);
  }

  /* ─────────── Place Bet ─────────── */
  async function placeBet() {
    if (picks.size === 0) { showMsg('Pick at least 1 number!', false); return; }
    if (phase !== 'BETTING') { showMsg('Betting is closed for this round.', false); return; }
    setIsPlacing(true);
    try {
      const res = await api.post('/keno/ticket', {
        picks: Array.from(picks),
        stakeCents: stake * 100,
      });
      if (res.data?.newBalanceCents !== undefined) {
        setLocalBalance(res.data.newBalanceCents / 100);
      }
      setTicketPlaced(true);
      showMsg(`🎱 Ticket placed! ${picks.size} picks × ${stake} ETB`, true);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error ?? 'Bet failed. Try again.';
      showMsg(errMsg, false);
    } finally {
      setIsPlacing(false);
    }
  }

  /* ─────────── Derived ─────────── */
  const drawn = round?.drawnNumbers ?? [];
  const drawnSet = new Set(drawn);
  const drawnCount = drawn.length;
  const timeLeft = localSecondsLeft;
  const isBetting = phase === 'BETTING';
  const isDrawing = phase === 'DRAWING';
  const isCompleted = phase === 'COMPLETED';
  const myPicks = Array.from(picks).sort((a, b) => a - b);
  const hitPicks = myPicks.filter((p) => drawnSet.has(p));
  const maxAllowed = spotChoice ?? MAX_PICKS;
  const allCount = liveTickets.length;
  const myCount = liveTickets.filter((t) => t.isOwn).length;
  const filteredTickets = liveTickets.filter((t) => {
    if (subTab === 'MY_TICKETS' || subTab === 'MY_BETS') return t.isOwn;
    return true;
  });

  /* ════════════════════════════════════════════════════════════
     SPLASH SCREEN
  ════════════════════════════════════════════════════════════ */
  if (showSplash) {
    return (
      <div style={ROOT}>
        <BgGlows />
        <div style={css.splashWrap}>
          {/* blurred giant bg numbers */}
          <div style={css.splashBg80}>80</div>
          <div style={css.splashBgText}>FAST KENO</div>

          {/* main card */}
          <div
            id="keno-splash-card"
            style={css.splashCard}
            onClick={() => setShowSplash(false)}
          >
            {/* shield badge top-right */}
            <div style={css.splashShield}><CheckSVG size={14} /></div>

            {/* 3-D ball */}
            <div style={css.splashBallWrap}>
              <KenoBall number={80} size={90} />
            </div>

            {/* logo text */}
            <div style={css.splashLogo}>
              <span style={{ fontStyle: 'italic', color: '#fff' }}>FAST</span>
              <br />
              <span style={{ color: '#22c55e', fontStyle: 'italic' }}>KEN</span>
              <span style={{ color: '#22c55e', fontSize: 20 }}>▶</span>
            </div>
            <div style={css.splashGift}>BUNA BET</div>
          </div>

          <div style={css.splashTitle}>Fast Keno</div>

          {/* dot pager */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <div style={{ ...css.dot, background: '#9ca3af' }} />
            <div style={css.dot} />
            <div style={css.dot} />
          </div>
        </div>
        <GlobalStyle />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     MAIN GAME SCREEN
  ════════════════════════════════════════════════════════════ */
  if (showRules) {
    return (
      <div style={ROOT}>
        <RulesOverlay onClose={() => setShowRules(false)} />
        <GlobalStyle />
      </div>
    );
  }

  return (
    <div style={ROOT}>
      <BgGlows />

      {/* ── TOP HEADER ── */}
      <div style={css.header}>
        {/* Balance pill */}
        <div style={css.balancePill}>
          <span style={css.balanceDot} />
          <span style={css.balanceAmt}>{localBalance}</span>
          <span style={css.balanceCur}>&nbsp;ETB</span>
        </div>

        {/* Round ID */}
        <div style={css.roundId}>
          ID:&nbsp;<strong>{round?.roundCode ?? '——'}</strong>
          &nbsp;<CheckSVG size={11} />
        </div>

        {/* Draw counter */}
        <div style={css.drawCounter}>
          <span style={{ color: '#22c55e', fontWeight: 800 }}>
            {String(drawnCount).padStart(2, '0')}
          </span>
          <span style={{ color: '#334155' }}>&nbsp;/&nbsp;{TOTAL_DRAW}</span>
        </div>
      </div>

      {/* ── GAME AREA (phase-dependent) ── */}
      {(isBetting || phase === 'IDLE') && (
        <BettingArea
          phase={phase}
          timeLeft={timeLeft}
          picks={picks}
          spotChoice={spotChoice}
          maxAllowed={maxAllowed}
          ticketPlaced={ticketPlaced}
          stake={stake}
          onSelectSpot={selectSpot}
          onOpenRules={() => setShowRules(true)}
        />
      )}

      {isDrawing && (
        <DrawingArea
          drawn={drawn}
          latestBall={latestBall}
          bigBallVisible={bigBallVisible}
          animBalls={animBalls}
          myPicks={myPicks}
        />
      )}

      {/* ── NUMBER GRID (Always visible unless DRAWING) ── */}
      {(isBetting || phase === 'COMPLETED') && (
        <div style={css.gridWrap}>
          <div style={css.grid} id="keno-number-grid">
            {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
              const isPicked = picks.has(n);
              const isDrawn = drawnSet.has(n);
              const isHit = isPicked && isDrawn;
              const canInteract = isBetting && !ticketPlaced;

              let bg = 'rgba(20,30,45,0.65)';
              let color = '#64748b';
              let border = '1px solid rgba(255,255,255,0.04)';
              let shadow = 'none';
              let dotColor: string | null = null;

              if (isHit) {
                bg = 'linear-gradient(135deg,#22c55e,#16a34a)';
                color = '#fff';
                border = '1px solid #22c55e';
                shadow = '0 0 10px rgba(34,197,94,0.5)';
              } else if (isPicked) {
                bg = 'rgba(20,30,45,0.85)';
                color = '#e2e8f0';
                border = '1px solid rgba(255,255,255,0.08)';
                dotColor = '#3b82f6';
              } else if (isDrawn) {
                bg = 'rgba(10,15,25,0.9)';
                color = '#94a3b8';
                border = '1px solid rgba(255,255,255,0.05)';
                dotColor = '#ef4444';
              }

              return (
                <button
                  key={n}
                  id={`keno-num-${n}`}
                  onClick={() => togglePick(n)}
                  disabled={!canInteract && !isPicked}
                  style={{
                    ...css.gridCell,
                    background: bg, color, border, boxShadow: shadow,
                    cursor: canInteract ? 'pointer' : 'default',
                    opacity: !isBetting && !isDrawn && !isPicked ? 0.35 : 1,
                    position: 'relative',
                  }}
                >
                  {dotColor && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 5, height: 5, borderRadius: '50%',
                      background: dotColor, pointerEvents: 'none',
                    }} />
                  )}
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BET CONTROLS (Always visible during BETTING) ── */}
      {isBetting && (
        <div style={css.betControls}>
          <div style={css.stakeRow}>
            <button id="keno-stake-minus" onClick={() => adjustStake(-STAKE_STEP)} style={css.stakeAdj}>−</button>
            <div style={css.stakeVal}>{stake}</div>
            <button id="keno-stake-plus" onClick={() => adjustStake(STAKE_STEP)} style={css.stakeAdj}>+</button>
            <button id="keno-stake-x2" onClick={doubleStake} style={css.stakeMod}>X2</button>
            <button id="keno-stake-max" onClick={maxStake} style={css.stakeMod}>MAX</button>
          </div>

          {msg && (
            <div style={{
              ...css.msgBar,
              background: msg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              borderColor: msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
              color: msg.ok ? '#4ade80' : '#f87171',
            }}>
              {msg.text}
            </div>
          )}

          {!ticketPlaced ? (
            <button
              id="keno-bet-btn"
              onClick={placeBet}
              disabled={isPlacing || picks.size === 0}
              style={{
                ...css.betBtn,
                background: picks.size === 0
                  ? 'rgba(255,255,255,0.04)'
                  : 'linear-gradient(135deg,#22c55e,#15803d)',
                color: picks.size === 0 ? '#334155' : '#fff',
                boxShadow: picks.size > 0 ? '0 4px 20px rgba(34,197,94,0.35)' : 'none',
              }}
            >
              {isPlacing ? 'Processing...' : picks.size === 0 ? 'Pick Numbers First' : 'BET'}
            </button>
          ) : (
            <div style={css.ticketConfirmed}>
              ✓ Ticket Confirmed — watching {picks.size} picks
            </div>
          )}

          <div style={css.quickRow}>
            <button id="keno-quick-pick" onClick={quickPick} style={css.quickBtn}>⚡ Quick Pick</button>
            {picks.size > 0 && (
              <button id="keno-clear" onClick={() => setPicks(new Set())} style={css.clearBtn}>✕ Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN TABS ── */}
      <div style={css.tabs}>
        {(['GAME', 'HISTORY', 'RESULTS', 'STATISTICS', 'LEADERS'] as MainTab[]).map((t) => (
          <button
            key={t}
            id={`keno-tab-${t.toLowerCase()}`}
            onClick={() => setMainTab(t)}
            style={{
              ...css.tabBtn,
              color: mainTab === t ? '#22c55e' : '#475569',
              borderBottom: mainTab === t ? '2px solid #22c55e' : '2px solid transparent',
            }}
          >
            {TAB_ICONS[t]}&nbsp;{t}
          </button>
        ))}
      </div>

      {/* ── TAB BODY ── */}
      <div style={css.tabBody}>
        {mainTab === 'GAME' && (
          <GameTabContent
            phase={phase}
            picks={picks}
            drawnSet={drawnSet}
            myPicks={myPicks}
            hitPicks={hitPicks}
            stake={stake}
            isBetting={isBetting}
            ticketPlaced={ticketPlaced}
            isPlacing={isPlacing}
            msg={msg}
            subTab={subTab}
            allCount={allCount}
            myCount={myCount}
            filteredTickets={filteredTickets}
            maxAllowed={maxAllowed}
            roundCode={round?.roundCode}
            onTogglePick={togglePick}
            onSetSubTab={setSubTab}
            onAdjustStake={adjustStake}
            onDoubleStake={doubleStake}
            onMaxStake={maxStake}
            onQuickPick={quickPick}
            onBet={placeBet}
            onClear={() => setPicks(new Set())}
          />
        )}
        {mainTab === 'HISTORY' && <HistoryTab rounds={historyRounds} />}
        {mainTab === 'RESULTS' && (
          <ResultsTab
            myPicks={myPicks}
            hitPicks={hitPicks}
            drawnSet={drawnSet}
            phase={phase}
            round={round}
          />
        )}
        {mainTab === 'STATISTICS' && (
          <StatisticsTab hot={hotNumbers} cold={coldNumbers} />
        )}
        {mainTab === 'LEADERS' && <LeadersTab tickets={liveTickets} drawnSet={drawnSet} />}
      </div>

      {/* ── FAIRNESS FOOTER — only shown when not actively drawing ── */}
      {!isDrawing && (
        <div style={css.fairness}>
          <div style={css.fairnessShield}><CheckSVG size={22} /></div>
          <div style={css.fairnessLabel}>FAIRNESS</div>
          <div style={css.fairnessBrand}>ATLAS V<br /><span style={{ fontSize: 8, letterSpacing: 3 }}>GAMING</span></div>
        </div>
      )}

      <GlobalStyle />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   BETTING AREA — countdown clock + pick instruction + spot selector
════════════════════════════════════════════════════════════ */
function BettingArea({
  phase, timeLeft, picks, spotChoice, maxAllowed, ticketPlaced, stake, onSelectSpot, onOpenRules,
}: {
  phase: RoundPhase; timeLeft: number; picks: Set<number>; spotChoice: number | null;
  maxAllowed: number; ticketPlaced: boolean; stake: number;
  onSelectSpot: (n: number) => void; onOpenRules: () => void;
}) {
  const isBetting = phase === 'BETTING';
  const urgent = timeLeft <= 5 && isBetting;
  const hasPicks = picks.size > 0;
  const spotCount = spotChoice ?? (hasPicks ? picks.size : maxAllowed);
  const payoutRows = PAYOUT_TABLE[spotCount] ?? [];
  const maxWin = payoutRows.length > 0 ? payoutRows[payoutRows.length - 1].mult * stake : 0;
  const picksArr = Array.from(picks).sort((a, b) => a - b);

  return (
    <div style={css.bettingArea}>
      {/* countdown */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 120, height: 20, background: 'radial-gradient(ellipse, rgba(45,212,191,0.2) 0%, transparent 70%)',
          zIndex: 0,
        }} />
        <div style={{
          ...css.clock,
          color: urgent ? '#ef4444' : '#ccfbf1',
          textShadow: urgent ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(45,212,191,0.5)',
          zIndex: 1,
        }}>
          {isBetting ? fmtClock(timeLeft) : phase === 'IDLE' ? '00:00' : '—'}
        </div>
      </div>

      <div style={{ minHeight: 125, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {hasPicks && isBetting ? (
          /* ── PAYOUT & PICKS UI (replaces card) ── */
          <div style={{ position: 'relative', width: '100%', padding: '0 4px' }}>
            {/* Possible win header */}
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
              {spotCount} Possible win&nbsp;
              <span style={{ color: '#4ade80' }}>{(maxWin * 100).toLocaleString()}</span>
            </div>
            
            {/* Payout table */}
            <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${payoutRows.length}, 1fr)`, gap: '4px 6px', fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>Match</div>
              {payoutRows.map(r => <div key={`match-${r.match}`} style={{ textAlign: 'center', fontWeight: 600 }}>{r.match}</div>)}
              <div style={{ fontWeight: 600 }}>Pays</div>
              {payoutRows.map(r => <div key={`pays-${r.match}`} style={{ textAlign: 'center', color: '#e2e8f0', fontWeight: 700 }}>x{r.mult}</div>)}
            </div>

            {/* 10 Fixed Box Row for Picks */}
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: maxAllowed }).map((_, i) => {
                const num = picksArr[i];
                return (
                  <div key={i} style={{
                    flex: 1, height: 32, borderRadius: 4,
                    background: num ? '#334155' : 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#f8fafc',
                  }}>
                    {num || ''}
                  </div>
                );
              })}
            </div>

            <button id="keno-open-rules" onClick={onOpenRules} style={{
              position: 'absolute', top: -4, right: 4,
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              color: '#4ade80', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>?</button>
          </div>
        ) : (
          /* ── INSTRUCTION CARD (DEFAULT) ── */
          <div style={{ ...css.instructionRow, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 12, zIndex: 0 }}>
              <div style={{ position: 'absolute', width: 200, height: 200, border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%', left: '30%', top: '-50%' }} />
              <div style={{ position: 'absolute', width: 300, height: 300, border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%', left: '20%', top: '-80%' }} />
            </div>
            
            <div style={{ position: 'relative', width: 70, height: 60, marginRight: 6 }}>
              <div style={{ position: 'absolute', top: -14, left: -4, transform: 'scale(0.55)', zIndex: 1 }}>
                <KenoBall number={80} size={44} />
              </div>
              <div style={{ position: 'absolute', top: -20, left: 16, transform: 'scale(0.75)', zIndex: 2 }}>
                <KenoBall number={10} size={44} />
              </div>
              <div style={{ position: 'absolute', top: 4, left: -6, zIndex: 3 }}>
                <KenoBall number={picks.size || 1} size={54} />
              </div>
            </div>

            <div style={{ flex: 1, zIndex: 4 }}>
              <div style={css.instrTitle}>Choose {maxAllowed} numbers</div>
              <div style={css.instrSub}>From 1 to 80</div>
            </div>

            <button id="keno-open-rules" onClick={onOpenRules} style={{
              position: 'absolute', top: 12, right: 12, zIndex: 4,
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)', border: 'none',
              color: '#4ade80', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>?</button>
          </div>
        )}
      </div>

      {/* spot selector removed to match Image 2 */}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DRAWING AREA — big ball + two rows of drawn balls
════════════════════════════════════════════════════════════ */
function DrawingArea({
  drawn, latestBall, bigBallVisible, animBalls, myPicks,
}: {
  drawn: number[]; latestBall: number | null; bigBallVisible: boolean;
  animBalls: Set<number>; myPicks: number[];
}) {
  return (
    <div style={css.drawingArea}>
      {/* large animated ball */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div style={{
          ...css.bigBallWrap,
          opacity: bigBallVisible ? 1 : 0,
          animation: bigBallVisible ? 'dropIn 0.45s cubic-bezier(.175,.885,.32,1.275) forwards' : 'none',
        }}>
          <KenoBall number={latestBall ?? 0} size={90} glow />
        </div>
      </div>

      {/* two rows: 10 balls each */}
      {[0, 1].map((row) => (
        <div key={row} style={css.drawnRow}>
          {drawn.slice(row * 10, row * 10 + 10).map((n) => {
            const isHit = myPicks.includes(n);
            const isNew = animBalls.has(n);
            return (
              <div
                key={n}
                style={{
                  animation: isNew ? 'popBall 0.4s cubic-bezier(.175,.885,.32,1.275)' : 'none',
                }}
              >
                <KenoBall number={n} size={34} hit={isHit} mini />
              </div>
            );
          })}
          {/* placeholders so the row always fills */}
          {drawn.slice(row * 10, row * 10 + 10).length < 10 &&
            Array.from({ length: 10 - drawn.slice(row * 10, row * 10 + 10).length }).map((_, i) => (
              <div key={`ph${i}`} style={css.ballPlaceholder} />
            ))}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GAME TAB — number grid + bet controls + live tickets
════════════════════════════════════════════════════════════ */
function GameTabContent({
  phase, picks, drawnSet, myPicks, hitPicks, stake, isBetting, ticketPlaced,
  isPlacing, msg, subTab, allCount, myCount, filteredTickets, maxAllowed,
  roundCode, onTogglePick, onSetSubTab, onAdjustStake, onDoubleStake,
  onMaxStake, onQuickPick, onBet, onClear,
}: {
  phase: RoundPhase; picks: Set<number>; drawnSet: Set<number>; myPicks: number[];
  hitPicks: number[]; stake: number; isBetting: boolean; ticketPlaced: boolean;
  isPlacing: boolean; msg: { text: string; ok: boolean } | null; subTab: SubTab;
  allCount: number; myCount: number; filteredTickets: LiveTicket[]; maxAllowed: number;
  roundCode?: string; onTogglePick: (n: number) => void; onSetSubTab: (t: SubTab) => void;
  onAdjustStake: (d: number) => void; onDoubleStake: () => void; onMaxStake: () => void;
  onQuickPick: () => void; onBet: () => void; onClear: () => void;
}) {
  const showGrid = isBetting || phase === 'COMPLETED';

  return (
    <div>
      {/* ── LIVE FEED ── */}
      <div style={css.feed}>
        {/* sub-tabs */}
        <div style={css.subTabs}>
          {([['ALL', `All ${allCount}`], ['MY_TICKETS', `My Tickets ${myCount}`], ['MY_BETS', `My Bets ${myCount}`]] as [SubTab, string][]).map(([key, label]) => (
            <button
              key={key}
              id={`keno-subtab-${key.toLowerCase()}`}
              onClick={() => onSetSubTab(key)}
              style={{
                ...css.subTabBtn,
                color: subTab === key ? '#e2e8f0' : '#475569',
                fontWeight: subTab === key ? 700 : 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredTickets.length === 0 ? (
          <div style={css.feedEmpty} />
        ) : (
          filteredTickets.map((t) => (
            <TicketCard key={t.id} ticket={t} drawnSet={drawnSet} />
          ))
        )}
      </div>
    </div>
  );
}

/* ────────── Ticket card ────────── */
function TicketCard({ ticket, drawnSet }: { ticket: LiveTicket; drawnSet: Set<number> }) {
  const picks = ticket.picks.slice(0, 10);
  const empties = Math.max(0, 8 - picks.length);

  return (
    <div style={css.tCard}>
      <div style={css.tUsername}>{maskName(ticket.username)}</div>
      <div style={css.tPicks}>
        {picks.map((p) => {
          const hit = drawnSet.has(p);
          return (
            <div key={p} style={{
              ...css.tCell,
              background: hit ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(20,30,45,0.9)',
              color: hit ? '#fff' : '#94a3b8',
              border: hit ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.05)',
            }}>
              {p}
            </div>
          );
        })}
        {Array.from({ length: empties }).map((_, i) => (
          <div key={`e${i}`} style={css.tEmpty} />
        ))}
      </div>
      <div style={css.tMeta}>
        <span style={css.tBetLabel}>Bet {fmtETB(ticket.stakeCents)}</span>
        {(ticket.status === 'WAITING' || ticket.status === 'PLACED') && (
          <span style={css.statusWaiting}>WAITING</span>
        )}
        {ticket.status === 'WON' && (
          <span style={css.statusWon}>WON {fmtETB(ticket.payoutCents ?? 0)}</span>
        )}
        {ticket.status === 'LOST' && (
          <span style={css.statusLost}>LOST</span>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HISTORY TAB
════════════════════════════════════════════════════════════ */
function HistoryTab({ rounds }: { rounds: HistoryRound[] }) {
  if (rounds.length === 0) {
    return <div style={css.tabEmpty}>No round history yet</div>;
  }
  return (
    <div style={{ padding: '10px 10px 80px' }}>
      {rounds.map((r, i) => (
        <div key={i} style={css.histCard}>
          <div style={css.histHeader}>
            Round {r.roundCode}
            <span style={{ color: '#334155', marginLeft: 8, fontWeight: 400 }}>
              {new Date(r.drawnAt).toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {r.drawnNumbers.map((n) => (
              <div key={n} style={css.histBall}>{n}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RESULTS TAB
════════════════════════════════════════════════════════════ */
function ResultsTab({
  myPicks, hitPicks, drawnSet, phase, round,
}: {
  myPicks: number[]; hitPicks: number[]; drawnSet: Set<number>;
  phase: RoundPhase; round: RoundState | null;
}) {
  if (myPicks.length === 0) {
    return <div style={css.tabEmpty}>No ticket placed this round</div>;
  }
  return (
    <div style={{ padding: '12px 10px 80px' }}>
      <div style={css.resultCard}>
        <div style={css.resultTitle}>
          Your Picks — <span style={{ color: '#22c55e' }}>{hitPicks.length}</span>/{myPicks.length} hits
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {myPicks.map((p) => {
            const hit = drawnSet.has(p);
            return (
              <div key={p} style={{
                width: 36, height: 36, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: hit ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(20,30,45,0.9)',
                color: hit ? '#fff' : '#94a3b8',
                border: hit ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: hit ? '0 0 10px rgba(34,197,94,0.4)' : 'none',
              }}>
                {p}
              </div>
            );
          })}
        </div>
        {phase === 'COMPLETED' && round?.serverSeed && (
          <div style={{ marginTop: 14, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, fontSize: 10, color: '#334155', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            <div style={{ color: '#475569', marginBottom: 4, fontSize: 11 }}>Provably Fair — Server Seed:</div>
            {round.serverSeed}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATISTICS TAB
════════════════════════════════════════════════════════════ */
function StatisticsTab({ hot, cold }: { hot: number[]; cold: number[] }) {
  return (
    <div style={{ padding: '12px 10px 80px' }}>
      {hot.length === 0 ? (
        <div style={css.tabEmpty}>Loading statistics…</div>
      ) : (
        <>
          <StatGroup label="🔥 Hot Numbers (last 100 rounds)" numbers={hot} accentColor="rgba(239,68,68,0.2)" accentBorder="rgba(239,68,68,0.4)" textColor="#f87171" />
          <div style={{ height: 12 }} />
          <StatGroup label="❄️ Cold Numbers (last 100 rounds)" numbers={cold} accentColor="rgba(59,130,246,0.2)" accentBorder="rgba(59,130,246,0.4)" textColor="#60a5fa" />
        </>
      )}
    </div>
  );
}

function StatGroup({
  label, numbers, accentColor, accentBorder, textColor,
}: {
  label: string; numbers: number[]; accentColor: string; accentBorder: string; textColor: string;
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {numbers.map((n) => (
          <div key={n} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: accentColor, border: `1px solid ${accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: textColor,
          }}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LEADERS TAB
════════════════════════════════════════════════════════════ */
function LeadersTab({ tickets, drawnSet }: { tickets: LiveTicket[]; drawnSet: Set<number> }) {
  const sorted = [...tickets]
    .filter((t) => t.status === 'WON')
    .sort((a, b) => (b.payoutCents ?? 0) - (a.payoutCents ?? 0))
    .slice(0, 10);

  if (sorted.length === 0) {
    return <div style={css.tabEmpty}>No winners this round yet</div>;
  }

  return (
    <div style={{ padding: '10px 10px 80px' }}>
      {sorted.map((t, i) => (
        <div key={t.id} style={{ ...css.tCard, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18, width: 28, textAlign: 'center' as const, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#78350f' }}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>{maskName(t.username)}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Bet {fmtETB(t.stakeCents)} ETB</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>
            +{fmtETB(t.payoutCents ?? 0)} ETB
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RULES OVERLAY
════════════════════════════════════════════════════════════ */
function RulesOverlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'RULES' | 'FAIRNESS'>('RULES');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 100, position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
          <span style={{ fontSize: 20 }}>←</span> Back
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        <button onClick={() => setTab('RULES')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: tab === 'RULES' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'RULES' ? '#22c55e' : '#94a3b8', border: tab === 'RULES' ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          ℹ️ RULES
        </button>
        <button onClick={() => setTab('FAIRNESS')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: tab === 'FAIRNESS' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'FAIRNESS' ? '#22c55e' : '#94a3b8', border: tab === 'FAIRNESS' ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          ✔️ FAIRNESS
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
        {tab === 'RULES' ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#94a3b8' }}>RTP: 97%</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8, color: '#e2e8f0' }}>Max Win - 30000 ETB</div>
            </div>
            
            <p style={{ marginBottom: 16 }}>
              "Keno" is a game where the player bets on 1-80 numbered balls by choosing a combination from 1 to 10 numbered balls.
            </p>
            <p style={{ marginBottom: 24 }}>
              During each round, 20 of the balls numbered from 1 to 80 in sequence are drawn using a random number generator.
            </p>

            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 12 }}>How to play</h3>
            <p style={{ marginBottom: 12 }}>
              To participate in the game, the player must perform the following actions during the round, which lasts one minute:
            </p>
            <div style={{ paddingLeft: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>- Choose the combination of numbers</div>
              <div>- Set the amount limit for betting</div>
              <div>- Click the "Bet" button</div>
            </div>
            <p style={{ marginBottom: 16 }}>
              The player can also delete the combination of already selected numbers.
            </p>
            <p style={{ marginBottom: 24 }}>
              In the field where the numbers from 1 to 80 are present, HOT and COLD numbers are indicated in red and blue colors, with hot numbers being those that are frequently drawn and blue being those that are drawn more infrequently.
            </p>

            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 12 }}>Payments</h3>
            <p style={{ marginBottom: 16 }}>
              All winning ball combinations have corresponding odds, which is multiplied by the player's bet amount.
            </p>
            <p style={{ marginBottom: 24 }}>
              The winning combination is calculated as the ratio of the number of balls bet to the number of guessed balls. For example, if you guessed 4 out of 5, the bet would be calculated at 30x.
            </p>

            {/* Paytable Matrix Placeholder (approximated from image) */}
            <div style={{ overflowX: 'auto', marginBottom: 24, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '6px' }}>Hits \\ Picks</th>
                    <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#e2e8f0' }}>
                  <tr><td style={{ color: '#94a3b8' }}>0</td><td></td><td></td><td></td><td></td><td></td><td></td><td>1</td><td>1</td><td>2</td><td>2</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>1</td><td>3.5</td><td>1</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>2</td><td></td><td>10</td><td>2</td><td>1.5</td><td>1</td><td></td><td></td><td></td><td></td><td></td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>3</td><td></td><td></td><td>50</td><td>10</td><td>3</td><td>2</td><td>2</td><td></td><td></td><td></td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>4</td><td></td><td></td><td></td><td>80</td><td>30</td><td>15</td><td>4</td><td>5</td><td>2</td><td></td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>5</td><td></td><td></td><td></td><td></td><td>150</td><td>60</td><td>20</td><td>15</td><td>10</td><td>5</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>6</td><td></td><td></td><td></td><td></td><td></td><td>500</td><td>80</td><td>50</td><td>25</td><td>30</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>7</td><td></td><td></td><td></td><td></td><td></td><td></td><td>1000</td><td>200</td><td>125</td><td>100</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>8</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>2000</td><td>1000</td><td>300</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>9</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>5000</td><td>2000</td></tr>
                  <tr><td style={{ color: '#94a3b8' }}>10</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>10000</td></tr>
                </tbody>
              </table>
            </div>

            <p style={{ color: '#94a3b8', fontSize: 11, paddingBottom: 40 }}>
              Disconnection policy: If a disconnection occurs after active game round and your bets were accepted by the server, the game will proceed as normal and any winnings will be processed according to the game result regardless of the disconnection.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.05))', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <CheckSVG size={26} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>ABOUT FAIRNESS</h3>
            </div>

            <p style={{ marginBottom: 16 }}>
              Before the start of a round, the players are provided with a "Hash Code*" - an encrypted text combination "Key*". Here are the round outcome numbers.
            </p>
            <p style={{ marginBottom: 16 }}>
              The outcome of the round is determined not at the moment of the game, but in advance for current round, and is given to the players in coded form.
            </p>
            <p style={{ marginBottom: 16 }}>
              Hash (Hash) code * -
            </p>
            <p style={{ marginBottom: 16 }}>
              After the end of a round, the players are provided with a "Key*" and an additional input parameter for getting the "Hash Code*" - "Salt*". Using them, every player can copy and encrypt this combination to see that the encrypted "Key * " corresponds to the "Hash code *" previously determined by the system. This ensures that the outcome of the game is determined not at the moment of the round, but previously, before playing a round.
            </p>
            
            <p style={{ marginBottom: 16 }}>
              What is "Salt*" - it is a random sequence of letters and numbers. For instance: e20d4c76c654.
            </p>
            
            <div style={{ marginBottom: 16 }}>
              What is "Key*" - a text combination of four parameters
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16, marginTop: 8, color: '#e2e8f0' }}>
                <div>1. Round Id</div>
                <div>2. The outcome numbers</div>
                <div>3. Wording "Keno"</div>
                <div>4. A random sequence of letters and numbers</div>
              </div>
            </div>

            <p style={{ paddingBottom: 40 }}>
              To get a hash code you can click on check icon in Result section and perform the check. You can get the encryption "Key*" and "Hash Code*" below or check on any online server that has a generator SHA512 With Salt.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
════════════════════════════════════════════════════════════ */

/** 3-D keno ball */
function KenoBall({
  number, size, glow = false, hit = false, mini = false,
}: {
  number: number; size: number; glow?: boolean; hit?: boolean; mini?: boolean;
}) {
  const fontSize = mini ? Math.floor(size * 0.33) : Math.floor(size * 0.42);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: hit
        ? 'radial-gradient(circle at 32% 30%,#4ade80,#15803d)'
        : 'radial-gradient(circle at 32% 30%,#1e4030,#0a1a10)',
      border: hit ? '2px solid rgba(74,222,128,0.5)' : `${size > 50 ? 2 : 1.5}px solid rgba(34,197,94,0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      boxShadow: glow
        ? '0 0 30px rgba(34,197,94,0.25), 0 12px 40px rgba(0,0,0,0.8)'
        : hit
          ? '0 0 10px rgba(34,197,94,0.4)'
          : '0 4px 12px rgba(0,0,0,0.6)',
    }}>
      <span style={{
        fontSize, fontWeight: 900, color: '#fff',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        letterSpacing: number >= 10 ? -1 : 0,
        lineHeight: 1,
        zIndex: 1,
      }}>
        {number > 0 ? number : ''}
      </span>
      {/* shine */}
      <div style={{
        position: 'absolute', top: size * 0.1, left: size * 0.14,
        width: size * 0.38, height: size * 0.24, borderRadius: '50%',
        background: 'rgba(255,255,255,0.13)', transform: 'rotate(-30deg)',
        filter: `blur(${size * 0.05}px)`,
      }} />
      {/* glow ring */}
      {glow && (
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: '2px solid rgba(34,197,94,0.18)',
          animation: 'pulseRing 1.6s ease-out infinite',
        }} />
      )}
    </div>
  );
}

function CheckSVG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="8" cy="8" r="7.5" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
      <path d="M4.5 8.5L6.5 10.5L11.5 5.5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BgGlows() {
  return (
    <>
      <div style={{ position: 'absolute', top: -140, left: -60, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '30%', right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,83,45,0.07) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
    </>
  );
}

const TAB_ICONS: Record<MainTab, string> = {
  GAME: '▶',
  HISTORY: '↺',
  RESULTS: '✔',
  STATISTICS: '📊',
  LEADERS: '👑',
};

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
const ROOT: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(180deg,#0c1a11 0%,#08120c 60%,#050d08 100%)',
  color: '#fff',
  fontFamily: "'Inter','Roboto',system-ui,sans-serif",
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 480,
  margin: '0 auto',
  position: 'relative',
  overflow: 'hidden',
  overscrollBehavior: 'none',
};

const css: Record<string, React.CSSProperties> = {
  /* ── splash ── */
  splashWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: '100dvh', padding: '40px 24px', position: 'relative', zIndex: 1,
  },
  splashBg80: {
    position: 'absolute', fontSize: 230, fontWeight: 900,
    color: 'rgba(255,255,255,0.025)', userSelect: 'none',
    top: '50%', left: '50%', transform: 'translate(-50%,-55%)',
    pointerEvents: 'none', letterSpacing: -20,
  },
  splashBgText: {
    position: 'absolute', fontSize: 44, fontWeight: 900,
    color: 'rgba(255,255,255,0.02)', userSelect: 'none',
    top: '62%', left: '50%', transform: 'translateX(-50%)',
    pointerEvents: 'none', letterSpacing: 6, whiteSpace: 'nowrap',
  },
  splashCard: {
    width: 176, cursor: 'pointer', zIndex: 1,
    background: 'linear-gradient(160deg,#0e2d1a,#09200f)',
    border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: 18, padding: '22px 18px 18px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    boxShadow: '0 10px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    animation: 'fadeSlide 0.5s ease-out', position: 'relative',
  },
  splashShield: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(34,197,94,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  splashBallWrap: { marginBottom: 2 },
  splashLogo: {
    textAlign: 'center', fontSize: 22, fontWeight: 900,
    lineHeight: 1.15, letterSpacing: 1,
  },
  splashGift: {
    fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: 2,
  },
  splashTitle: {
    marginTop: 22, fontSize: 18, fontWeight: 700, color: '#e2e8f0', zIndex: 1,
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
  },

  /* ── header ── */
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px',
    background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    zIndex: 10, flexShrink: 0,
  },
  balancePill: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20, padding: '4px 10px',
  },
  balanceDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'block',
  },
  balanceAmt: { fontSize: 13, fontWeight: 800, color: '#e2e8f0' },
  balanceCur: { fontSize: 11, color: '#64748b', fontWeight: 500 },
  roundId: {
    fontSize: 11, color: '#64748b',
    display: 'flex', alignItems: 'center', gap: 3,
  },
  drawCounter: {
    fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
  },

  /* ── betting area ── */
  bettingArea: { padding: '8px 12px 4px', flexShrink: 0, zIndex: 1 },
  clock: {
    fontFamily: 'monospace, sans-serif',
    fontSize: 16, fontWeight: 700, letterSpacing: 4,
    fontVariantNumeric: 'tabular-nums',
    padding: '2px 0',
  },
  instructionRow: {
    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
    padding: '18px 16px',
    backgroundColor: '#15231c',
    backgroundImage: 'radial-gradient(circle at 10% 50%, rgba(34,197,94,0.05) 0%, transparent 40%), radial-gradient(circle at 50% 120%, rgba(34,197,94,0.05) 0%, transparent 50%)',
    border: '1px solid rgba(255,255,255,0.02)', borderRadius: 12,
  },
  instrTitle: { fontSize: 20, fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 },
  instrSub: { fontSize: 14, color: '#4ade80', fontWeight: 600, marginTop: 4 },
  spotRow: {
    display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2,
  },
  spotBtn: {
    flex: '0 0 auto', width: 31, height: 27, borderRadius: 6,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
  },

  /* ── drawing area ── */
  drawingArea: { padding: '8px 10px 4px', flexShrink: 0, zIndex: 1 },
  bigBallWrap: { transition: 'opacity 0.1s' },
  drawnRow: {
    display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 5,
  },
  ballPlaceholder: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.04)',
    flexShrink: 0,
  },

  /* ── main tabs ── */
  tabs: {
    display: 'flex', overflowX: 'auto',
    background: 'rgba(0,0,0,0.25)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0, zIndex: 5,
  },
  tabBtn: {
    flex: '1 0 auto', padding: '9px 4px', fontSize: 10, fontWeight: 600,
    letterSpacing: 0.4, background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 3, transition: 'all 0.12s', whiteSpace: 'nowrap',
  },
  tabBody: { flex: 1, overflowY: 'auto', zIndex: 1 },

  /* ── grid ── */
  gridWrap: { padding: '8px 9px 4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3 },
  gridCell: {
    height: 33, width: '100%', borderRadius: 5,
    fontSize: 12, fontWeight: 700, transition: 'all 0.1s',
    fontVariantNumeric: 'tabular-nums',
  },

  /* ── bet controls ── */
  betControls: {
    padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 7,
  },
  stakeRow: { display: 'flex', alignItems: 'center', gap: 5 },
  stakeAdj: {
    width: 38, height: 44, borderRadius: 8, fontSize: 20, fontWeight: 700,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
    color: '#e2e8f0', cursor: 'pointer',
  },
  stakeVal: {
    flex: 1, textAlign: 'center' as const, fontSize: 22, fontWeight: 800,
    color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: 8,
    padding: '9px 4px', fontVariantNumeric: 'tabular-nums',
  },
  stakeMod: {
    padding: '0 12px', height: 44, borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(34,197,94,0.2)',
    color: '#22c55e', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  betBtn: {
    width: '100%', height: 52, borderRadius: 10,
    fontSize: 18, fontWeight: 800, letterSpacing: 2, border: 'none',
    transition: 'all 0.15s',
  },
  msgBar: {
    padding: '8px 12px', borderRadius: 8, fontSize: 12,
    fontWeight: 600, border: '1px solid',
  },
  ticketConfirmed: {
    width: '100%', padding: '14px', borderRadius: 10, textAlign: 'center' as const,
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
    color: '#4ade80', fontSize: 13, fontWeight: 700,
  },
  quickRow: { display: 'flex', gap: 7 },
  quickBtn: {
    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    color: '#94a3b8', fontSize: 12, fontWeight: 600,
  },
  clearBtn: {
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171', fontSize: 12, fontWeight: 600,
  },

  /* ── live feed ── */
  feed: { borderTop: '1px solid rgba(255,255,255,0.04)' },
  subTabs: {
    display: 'flex', padding: '6px 10px', gap: 14,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  subTabBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: '2px 0',
  },
  feedEmpty: { padding: 20 },
  tCard: {
    padding: '9px 11px', borderBottom: '1px solid rgba(255,255,255,0.03)',
    background: 'rgba(0,0,0,0.12)',
  },
  tUsername: { fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 5 },
  tPicks: { display: 'flex', gap: 3, flexWrap: 'wrap' as const, marginBottom: 5 },
  tCell: {
    width: 30, height: 27, borderRadius: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700,
  },
  tEmpty: {
    width: 30, height: 27, borderRadius: 5,
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.05)',
  },
  tMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tBetLabel: { fontSize: 11, color: '#475569', fontWeight: 600 },
  statusWaiting: { fontSize: 11, color: '#f59e0b', fontWeight: 700 },
  statusWon: { fontSize: 11, color: '#22c55e', fontWeight: 700 },
  statusLost: { fontSize: 11, color: '#334155', fontWeight: 600 },

  /* ── history ── */
  histCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 10, padding: '11px', marginBottom: 7,
  },
  histHeader: { fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 },
  histBall: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'rgba(20,30,45,0.8)', border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700, color: '#94a3b8',
  },

  /* ── results ── */
  resultCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 10, padding: '14px',
  },
  resultTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },

  /* ── fairness ── */
  fairness: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', padding: '14px 0 20px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    gap: 6, flexShrink: 0, zIndex: 1,
  },
  fairnessShield: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))',
    border: '1px solid rgba(34,197,94,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fairnessLabel: {
    fontSize: 13, fontWeight: 800, color: '#e2e8f0', letterSpacing: 2,
  },
  fairnessBrand: {
    fontSize: 10, fontWeight: 700, color: '#1e293b',
    textAlign: 'center' as const, letterSpacing: 2,
  },

  /* ── misc ── */
  tabEmpty: {
    padding: '32px 16px', textAlign: 'center' as const,
    color: '#1e293b', fontSize: 13, fontWeight: 600,
  },
};

/* ════════════════════════════════════════════════════════════
   GLOBAL CSS KEYFRAMES
════════════════════════════════════════════════════════════ */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      ::-webkit-scrollbar{width:0;height:0;}
      @keyframes fadeSlide{
        from{opacity:0;transform:translateY(28px) scale(0.95);}
        to{opacity:1;transform:translateY(0) scale(1);}
      }
      @keyframes dropIn{
        0%{opacity:0;transform:translateY(-44px) scale(0.55);}
        70%{transform:translateY(5px) scale(1.08);}
        100%{opacity:1;transform:translateY(0) scale(1);}
      }
      @keyframes popBall{
        0%{transform:scale(0.4);opacity:0;}
        70%{transform:scale(1.15);}
        100%{transform:scale(1);opacity:1;}
      }
      @keyframes pulseRing{
        0%{opacity:0.55;transform:scale(1);}
        100%{opacity:0;transform:scale(1.6);}
      }
      @keyframes floatBall{
        0%,100%{transform:translateY(0);}
        50%{transform:translateY(-8px);}
      }
    `}</style>
  );
}
