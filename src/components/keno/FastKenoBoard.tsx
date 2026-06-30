'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getTgInitData } from '@/lib/telegram';

type RoundPhase = 'BETTING' | 'BETTING_CLOSED' | 'DRAWING' | 'COMPLETED';

interface RoundState {
  roundCode: string;
  phase: RoundPhase;
  secondsRemaining: number;
  drawnNumbers: number[];
  serverSeedHash: string;
  serverSeed?: string;
}

interface TicketResult {
  ticketId: string;
  picks: number[];
  stakeCents: number;
  hits?: number;
  payoutCents?: number;
  status: string;
}

const KENO_WS_URL = process.env.NEXT_PUBLIC_KENO_WS_URL ?? 'ws://localhost:8091';
const MAX_PICKS = 10;
const STAKE_PRESETS = [1000, 2000, 5000, 10000, 20000]; // in cents
const QUICK_PICKS = [1, 2, 3, 4, 5, 6, 8, 10];

export default function FastKenoBoard({ userId }: { userId: string }) {
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [round, setRound] = useState<RoundState | null>(null);
  const [stake, setStake] = useState(1000); // 10 ETB default
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastResult, setLastResult] = useState<TicketResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [ticketPlaced, setTicketPlaced] = useState(false);
  const [animatingBalls, setAnimatingBalls] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const prevDrawn = useRef<number[]>([]);

  const connectWS = useCallback(() => {
    const ws = new WebSocket(KENO_WS_URL);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      reconnectTimer.current = setTimeout(connectWS, 2000);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ROUND_UPDATE') {
          const update: RoundState = msg.data;
          setRound(update);
          if (update.phase === 'BETTING') {
            setTicketPlaced(false);
            prevDrawn.current = [];
          }
          const newBalls = update.drawnNumbers.filter(n => !prevDrawn.current.includes(n));
          if (newBalls.length > 0) {
            setAnimatingBalls(prev => new Set([...prev, ...newBalls]));
            setTimeout(() => setAnimatingBalls(new Set()), 600);
          }
          prevDrawn.current = update.drawnNumbers;
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWS]);

  function togglePick(n: number) {
    if (round?.phase !== 'BETTING' || ticketPlaced) return;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < MAX_PICKS) next.add(n);
      return next;
    });
  }

  function quickPick(count: number) {
    if (round?.phase !== 'BETTING' || ticketPlaced) return;
    const available = Array.from({ length: 80 }, (_, i) => i + 1);
    const shuffled = available.sort(() => Math.random() - 0.5);
    setPicks(new Set(shuffled.slice(0, count)));
  }

  async function placeBet() {
    if (picks.size === 0) { setMessage({ text: 'Pick at least 1 number first!', type: 'error' }); return; }
    if (round?.phase !== 'BETTING') { setMessage({ text: 'Betting is closed for this round.', type: 'error' }); return; }
    setIsPlacing(true);
    setMessage(null);
    try {
      const initData = typeof window !== 'undefined' ? getTgInitData() : '';
      const res = await fetch('/api/keno/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(initData ? { 'x-telegram-init-data': initData } : {}) },
        body: JSON.stringify({ userId, picks: Array.from(picks), stakeCents: stake, idempotencyKey: `keno-${Date.now()}-${Math.random().toString(36).slice(2)}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? 'Bet failed. Try again.', type: 'error' });
      } else {
        setTicketPlaced(true);
        setMessage({ text: `🎱 Ticket placed! ${picks.size} picks for ${(stake / 100).toFixed(0)} ETB`, type: 'success' });
        setLastResult({ ticketId: data.id, picks: Array.from(picks), stakeCents: stake, status: 'PLACED' });
      }
    } catch {
      setMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setIsPlacing(false);
    }
  }

  const drawnSet = new Set(round?.drawnNumbers ?? []);
  const hitCount = lastResult ? [...lastResult.picks].filter(p => drawnSet.has(p)).length : 0;
  const isBetting = round?.phase === 'BETTING';
  const isDrawing = round?.phase === 'DRAWING';
  const isCompleted = round?.phase === 'COMPLETED';
  const timeUrgent = (round?.secondsRemaining ?? 99) <= 3;
  const won = (lastResult?.payoutCents ?? 0) > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090b', // Deep zinc black
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto',
      position: 'relative', overflow: 'hidden'
    }}>

      {/* Modern Ambient Glows */}
      <div style={{ position: 'absolute', top: '-100px', left: '-50px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '100px', right: '-100px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* ── HEADER ── */}
      <div style={{
        background: 'rgba(24,24,27,0.8)',
        backdropFilter: 'blur(12px)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
          }}>🎱</div>
          <div>
            <div style={{
              fontWeight: '800', fontSize: '18px', letterSpacing: '-0.5px',
              background: 'linear-gradient(90deg, #fff, #94a3b8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Fast Keno</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Smart Draw System</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: wsConnected ? '#10b981' : '#ef4444',
              boxShadow: wsConnected ? '0 0 8px #10b981' : '0 0 8px #ef4444',
            }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: wsConnected ? '#34d399' : '#f87171' }}>
              {wsConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          {round && <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>#{round.roundCode}</span>}
        </div>
      </div>

      {/* ── ROUND STATUS ── */}
      <div style={{
        margin: '12px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: isBetting ? 'rgba(59,130,246,0.1)' : isDrawing ? 'rgba(245,158,11,0.1)' : isCompleted ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isBetting ? 'rgba(59,130,246,0.2)' : isDrawing ? 'rgba(245,158,11,0.2)' : isCompleted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>
            {isBetting ? '🎲' : isDrawing ? '🔮' : isCompleted ? '✨' : '⏳'}
          </div>
          <div>
            <div style={{
              fontWeight: '700', fontSize: '13px', letterSpacing: '0.05em',
              color: isBetting ? '#60a5fa' : isDrawing ? '#fbbf24' : isCompleted ? '#34d399' : '#94a3b8'
            }}>
              {isBetting ? 'PLACE YOUR BETS' : isDrawing ? 'DRAW IN PROGRESS' : isCompleted ? 'ROUND FINISHED' : 'WAITING...'}
            </div>
            {isBetting && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Select up to {MAX_PICKS} numbers</div>}
          </div>
        </div>
        {isBetting && round && (
          <div style={{
            background: timeUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(30,41,59,0.8)',
            border: `1px solid ${timeUrgent ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            padding: '6px 12px', borderRadius: '8px',
            color: timeUrgent ? '#f87171' : '#fff',
            fontWeight: '800', fontSize: '16px', fontVariantNumeric: 'tabular-nums'
          }}>
            {round.secondsRemaining}s
          </div>
        )}
      </div>

      {/* ── LAST TICKET RESULT ── */}
      {lastResult && isCompleted && (
        <div style={{
          margin: '0 12px 12px',
          padding: '16px',
          borderRadius: '12px',
          background: won ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.05))' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${won ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: won ? '#34d399' : '#94a3b8' }}>
                {won ? `🎉 YOU WON ${((lastResult.payoutCents ?? 0) / 100).toFixed(0)} ETB!` : `No win (${hitCount} hits)`}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Stake: {(lastResult.stakeCents / 100).toFixed(0)} ETB
              </div>
            </div>
            <button
              onClick={() => window.open(`/api/keno/verify/${round?.roundCode}`, '_blank')}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: '11px', cursor: 'pointer',
                padding: '6px 10px', borderRadius: '6px', fontWeight: '600'
              }}>
              Verify Fair
            </button>
          </div>
        </div>
      )}

      {/* ── DRAWN NUMBERS STRIP ── */}
      {(isDrawing || isCompleted) && round && round.drawnNumbers.length > 0 && (
        <div style={{
          margin: '0 12px 12px', padding: '12px',
          background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
            Drawn Numbers ({round.drawnNumbers.length}/20)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {round.drawnNumbers.map((n, i) => {
              const isHit = lastResult?.picks.includes(n);
              const isNew = animatingBalls.has(n);
              return (
                <div key={i} style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700',
                  background: isHit ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.1)',
                  color: isHit ? '#fff' : '#cbd5e1',
                  boxShadow: isHit ? '0 0 12px rgba(245,158,11,0.4)' : 'none',
                  animation: isNew ? 'popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
                }}>
                  {n}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── QUICK PICK ROW ── */}
      {isBetting && !ticketPlaced && (
        <div style={{ padding: '0 12px 12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {QUICK_PICKS.map(n => (
            <button key={n} onClick={() => quickPick(n)} style={{
              flex: '1', minWidth: '40px', padding: '6px 0', borderRadius: '6px',
              border: n === 8 ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.05)',
              background: n === 8 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
              color: n === 8 ? '#c4b5fd' : '#94a3b8',
              cursor: 'pointer', fontSize: '11px', fontWeight: '600'
            }}>
              {n} Pick
            </button>
          ))}
          {picks.size > 0 && (
            <button onClick={() => setPicks(new Set())} style={{
              padding: '6px 12px', borderRadius: '6px',
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
              color: '#f87171', cursor: 'pointer', fontSize: '11px', fontWeight: '600'
            }}>Clear</button>
          )}
        </div>
      )}

      {/* ── 80-NUMBER SMART GRID ── */}
      <div style={{ flex: 1, padding: '0 12px 12px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const isPicked = picks.has(n);
            const isDrawn = drawnSet.has(n);
            const isHit = isPicked && isDrawn;
            const canPick = isBetting && !ticketPlaced && (picks.size < MAX_PICKS || isPicked);

            // Default dark sleek style
            let bg = 'rgba(255,255,255,0.03)';
            let color = '#64748b';
            let border = '1px solid rgba(255,255,255,0.03)';
            let shadow = 'none';

            if (isHit) {
              // HIT: Gold/Amber
              bg = 'linear-gradient(135deg, #f59e0b, #d97706)';
              color = '#fff'; border = '1px solid #fbbf24';
              shadow = '0 0 10px rgba(245,158,11,0.5)';
            } else if (isPicked) {
              // PICKED: Electric Blue
              bg = 'linear-gradient(135deg, #3b82f6, #2563eb)';
              color = '#fff'; border = '1px solid #60a5fa';
              shadow = '0 0 10px rgba(59,130,246,0.4)';
            } else if (isDrawn) {
              // DRAWN (not picked): Emerald Green
              bg = 'rgba(16,185,129,0.15)';
              color = '#34d399'; border = '1px solid rgba(16,185,129,0.3)';
            }

            return (
              <button
                key={n}
                onClick={() => togglePick(n)}
                disabled={!canPick && !isPicked}
                style={{
                  height: '36px', width: '100%',
                  borderRadius: '6px',
                  fontSize: '13px', fontWeight: '700',
                  border, background: bg, color,
                  cursor: canPick || isPicked ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  boxShadow: shadow,
                  opacity: !isBetting && !isDrawn && !isPicked ? 0.4 : 1,
                }}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── STAKE + ACTION BAR ── */}
      <div style={{
        padding: '16px 12px 24px',
        background: 'rgba(24,24,27,0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {picks.size > 0 ? `${picks.size}/${MAX_PICKS} numbers selected` : 'Select numbers'}
          </span>
        </div>

        {/* Stake Toggle */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {STAKE_PRESETS.map(s => (
            <button key={s} onClick={() => setStake(s)} style={{
              flex: '1', padding: '10px 0', borderRadius: '8px',
              background: stake === s ? '#fff' : 'rgba(255,255,255,0.05)',
              color: stake === s ? '#09090b' : '#94a3b8',
              border: stake === s ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '12px', fontWeight: '700',
              transition: 'all 0.15s'
            }}>
              {s / 100}
            </button>
          ))}
        </div>

        {/* Message Toast */}
        {message && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: '600',
            background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171'
          }}>
            {message.text}
          </div>
        )}

        {/* Place Bet Button */}
        {!ticketPlaced ? (
          <button
            onClick={placeBet}
            disabled={!isBetting || isPlacing || picks.size === 0}
            style={{
              width: '100%', padding: '16px', borderRadius: '10px', cursor: 'pointer',
              background: (!isBetting || picks.size === 0)
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              border: 'none',
              color: (!isBetting || picks.size === 0) ? '#475569' : '#fff',
              fontSize: '15px', fontWeight: '700',
              boxShadow: isBetting && picks.size > 0 ? '0 4px 16px rgba(59,130,246,0.3)' : 'none',
            }}>
            {isPlacing ? 'Processing...' : !isBetting ? 'Waiting for Round...' : picks.size === 0 ? 'Pick Numbers' : `Place Bet · ${(stake / 100).toFixed(0)} ETB`}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '16px', borderRadius: '10px',
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#34d399', fontSize: '14px', fontWeight: '700', textAlign: 'center'
          }}>
            Ticket Confirmed ✓
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 0px; }
        @keyframes popIn { 0%{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}
