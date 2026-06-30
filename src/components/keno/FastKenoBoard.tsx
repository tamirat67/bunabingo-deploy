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
          // Animate newly drawn balls
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
      background: 'linear-gradient(180deg, #120008 0%, #1a000d 40%, #0d0005 100%)',
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto',
      position: 'relative', overflow: 'hidden'
    }}>

      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,20,60,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '0', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,0,30,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e0010 0%, #2d0015 100%)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(220,20,60,0.25)',
        boxShadow: '0 2px 20px rgba(220,20,60,0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #dc143c, #8b0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', boxShadow: '0 0 16px rgba(220,20,60,0.5)'
          }}>🎱</div>
          <div>
            <div style={{
              fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px',
              background: 'linear-gradient(90deg, #ff4d6d, #ff8fa3)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Fast Keno</div>
            <div style={{ fontSize: '10px', color: '#9f4455', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ቡና ቢንጎ · Instant Draw</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: wsConnected ? '#22c55e' : '#ef4444',
              boxShadow: wsConnected ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
              animation: wsConnected ? 'livePulse 2s infinite' : 'none'
            }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: wsConnected ? '#86efac' : '#fca5a5', letterSpacing: '0.05em' }}>
              {wsConnected ? 'LIVE' : 'Connecting...'}
            </span>
          </div>
          {round && <span style={{ fontSize: '10px', color: '#6b2133', fontFamily: 'monospace' }}>#{round.roundCode}</span>}
        </div>
      </div>

      {/* ── ROUND STATUS BAR ── */}
      <div style={{
        padding: '10px 16px',
        background: isBetting
          ? 'linear-gradient(90deg, rgba(220,20,60,0.12), rgba(139,0,0,0.08))'
          : isDrawing ? 'rgba(234,179,8,0.08)' : isCompleted ? 'rgba(34,197,94,0.08)' : 'rgba(30,0,15,0.6)',
        borderBottom: `1px solid ${isBetting ? 'rgba(220,20,60,0.2)' : 'rgba(255,255,255,0.04)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: isBetting ? 'rgba(220,20,60,0.15)' : isDrawing ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
          }}>
            {isBetting ? '🎯' : isDrawing ? '🎲' : isCompleted ? '✅' : '⏳'}
          </div>
          <div>
            <div style={{
              fontWeight: '800', fontSize: '13px', letterSpacing: '0.05em',
              color: isBetting ? '#ff4d6d' : isDrawing ? '#facc15' : isCompleted ? '#4ade80' : '#9f4455'
            }}>
              {isBetting ? 'BETTING OPEN' : isDrawing ? 'DRAWING NUMBERS...' : isCompleted ? 'ROUND COMPLETE' : 'Waiting for round...'}
            </div>
            {isBetting && <div style={{ fontSize: '10px', color: '#7f3344', marginTop: '1px' }}>Pick up to {MAX_PICKS} numbers</div>}
          </div>
        </div>
        {isBetting && round && (
          <div style={{
            minWidth: '54px', height: '54px', borderRadius: '50%',
            background: timeUrgent
              ? 'linear-gradient(135deg, #dc143c, #8b0000)'
              : 'linear-gradient(135deg, #2d0015, #1e0010)',
            border: `2px solid ${timeUrgent ? '#ff4d6d' : 'rgba(220,20,60,0.3)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: timeUrgent ? '0 0 20px rgba(220,20,60,0.6)' : '0 0 10px rgba(220,20,60,0.2)',
            animation: timeUrgent ? 'urgentPulse 0.5s infinite' : 'none'
          }}>
            <div style={{ fontSize: '22px', fontWeight: '900', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: timeUrgent ? '#fff' : '#ff8fa3' }}>
              {round.secondsRemaining}
            </div>
            <div style={{ fontSize: '8px', color: timeUrgent ? 'rgba(255,255,255,0.7)' : '#7f3344', letterSpacing: '0.05em' }}>SEC</div>
          </div>
        )}
      </div>

      {/* ── WIN / LOSS RESULT ── */}
      {lastResult && isCompleted && (
        <div style={{
          margin: '10px 12px',
          padding: '14px',
          borderRadius: '14px',
          background: won ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(21,128,61,0.08))' : 'rgba(220,20,60,0.08)',
          border: `1px solid ${won ? 'rgba(34,197,94,0.35)' : 'rgba(220,20,60,0.25)'}`,
          animation: 'slideDown 0.4s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: won ? '#4ade80' : '#ff8fa3' }}>
                {won ? `🎉 YOU WON +${((lastResult.payoutCents ?? 0) / 100).toFixed(0)} ETB!` : `💔 ${hitCount} Hit${hitCount !== 1 ? 's' : ''} — Try Again!`}
              </div>
              <div style={{ fontSize: '11px', color: '#7f3344', marginTop: '3px' }}>
                {hitCount} of {lastResult.picks.length} picks matched · Stake: {(lastResult.stakeCents / 100).toFixed(0)} ETB
              </div>
            </div>
            <button
              onClick={() => window.open(`/api/keno/verify/${round?.roundCode}`, '_blank')}
              style={{
                background: 'rgba(220,20,60,0.15)', border: '1px solid rgba(220,20,60,0.3)',
                color: '#ff8fa3', fontSize: '10px', cursor: 'pointer',
                padding: '5px 8px', borderRadius: '8px', fontWeight: '700', letterSpacing: '0.05em'
              }}>
              🛡️ VERIFY
            </button>
          </div>
        </div>
      )}

      {/* ── DRAWN NUMBERS ── */}
      {(isDrawing || isCompleted) && round && round.drawnNumbers.length > 0 && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(30,0,15,0.6)',
          borderBottom: '1px solid rgba(220,20,60,0.1)'
        }}>
          <div style={{ fontSize: '10px', color: '#7f3344', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' }}>
            Drawn Numbers · {round.drawnNumbers.length}/20
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {round.drawnNumbers.map((n, i) => {
              const isHit = lastResult?.picks.includes(n);
              const isNew = animatingBalls.has(n);
              return (
                <div key={i} style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '800',
                  background: isHit
                    ? 'linear-gradient(135deg, #dc143c, #8b0000)'
                    : 'linear-gradient(135deg, #2d0015, #1e0010)',
                  color: isHit ? '#fff' : '#ff8fa3',
                  border: isHit ? '1.5px solid #ff4d6d' : '1.5px solid rgba(220,20,60,0.25)',
                  boxShadow: isHit ? '0 0 12px rgba(220,20,60,0.6)' : 'none',
                  animation: isNew ? 'ballBounce 0.4s cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
                  transform: isHit ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.2s'
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
        <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', color: '#7f3344', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', marginRight: '2px' }}>Quick:</span>
          {QUICK_PICKS.map(n => (
            <button key={n} onClick={() => quickPick(n)} style={{
              padding: '4px 10px', borderRadius: '20px',
              border: n === 8 ? '1px solid rgba(220,20,60,0.6)' : '1px solid rgba(220,20,60,0.2)',
              background: n === 8 ? 'rgba(220,20,60,0.2)' : 'rgba(220,20,60,0.07)',
              color: n === 8 ? '#ff4d6d' : '#9f4455',
              cursor: 'pointer', fontSize: '11px', fontWeight: '700',
              transition: 'all 0.15s', position: 'relative'
            }}>
              {n}{n === 8 && <span style={{ position: 'absolute', top: '-6px', right: '-3px', background: '#dc143c', color: '#fff', fontSize: '7px', fontWeight: '900', padding: '1px 3px', borderRadius: '4px' }}>HOT</span>}
            </button>
          ))}
          {picks.size > 0 && (
            <button onClick={() => setPicks(new Set())} style={{
              padding: '4px 10px', borderRadius: '20px',
              border: '1px solid rgba(220,20,60,0.3)',
              background: 'rgba(220,20,60,0.08)',
              color: '#ff6b81', cursor: 'pointer', fontSize: '11px', fontWeight: '700'
            }}>✕ Clear</button>
          )}
        </div>
      )}

      {/* ── 80-NUMBER GRID ── */}
      <div style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '3px' }}>
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const isPicked = picks.has(n);
            const isDrawn = drawnSet.has(n);
            const isHit = isPicked && isDrawn;
            const canPick = isBetting && !ticketPlaced && (picks.size < MAX_PICKS || isPicked);

            let bg = 'rgba(255,255,255,0.04)';
            let color = '#5a2030';
            let shadow = 'none';
            let border = '1px solid rgba(220,20,60,0.08)';
            let scale = 'scale(1)';

            if (isHit) {
              bg = 'linear-gradient(135deg, #dc143c, #8b0000)';
              color = '#fff'; shadow = '0 0 14px rgba(220,20,60,0.7)';
              border = '1px solid #ff4d6d'; scale = 'scale(1.08)';
            } else if (isPicked) {
              bg = 'linear-gradient(135deg, #8b0000, #5c0017)';
              color = '#fff'; shadow = '0 0 10px rgba(220,20,60,0.4)';
              border = '1px solid rgba(220,20,60,0.6)'; scale = 'scale(1.05)';
            } else if (isDrawn) {
              bg = 'rgba(220,20,60,0.18)';
              color = '#ff8fa3'; border = '1px solid rgba(220,20,60,0.25)';
            }

            return (
              <button
                key={n}
                onClick={() => togglePick(n)}
                disabled={!canPick && !isPicked}
                style={{
                  height: '32px', width: '100%',
                  borderRadius: '7px',
                  fontSize: '11px', fontWeight: '800',
                  border, background: bg, color,
                  cursor: canPick || isPicked ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  boxShadow: shadow,
                  transform: scale,
                  opacity: !isBetting && !isDrawn && !isPicked ? 0.35 : 1,
                }}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── STAKE + BET CONTROLS ── */}
      <div style={{
        padding: '10px 12px 12px',
        background: 'linear-gradient(180deg, rgba(18,0,8,0.95) 0%, #120008 100%)',
        borderTop: '1px solid rgba(220,20,60,0.15)',
        boxShadow: '0 -4px 24px rgba(220,20,60,0.08)'
      }}>
        {/* Picks count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: picks.size > 0 ? '#ff8fa3' : '#5a2030', fontWeight: '600' }}>
            {picks.size > 0 ? `${picks.size}/${MAX_PICKS} spots selected` : 'Select your spots above'}
          </span>
          {picks.size > 0 && (
            <span style={{ fontSize: '11px', color: '#7f3344', fontWeight: '600', maxWidth: '55%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              [{Array.from(picks).sort((a, b) => a - b).join(', ')}]
            </span>
          )}
        </div>

        {/* Stake buttons */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
          {STAKE_PRESETS.map(s => (
            <button key={s} onClick={() => setStake(s)} style={{
              flex: '1', padding: '8px 2px', borderRadius: '9px',
              background: stake === s
                ? 'linear-gradient(135deg, #dc143c, #8b0000)'
                : 'rgba(220,20,60,0.08)',
              color: stake === s ? '#fff' : '#7f3344',
              cursor: 'pointer', fontSize: '11px', fontWeight: '800',
              boxShadow: stake === s ? '0 0 14px rgba(220,20,60,0.5)' : 'none',
              border: stake === s ? '1px solid rgba(220,20,60,0.6)' : '1px solid rgba(220,20,60,0.12)',
              transition: 'all 0.15s',
              transform: stake === s ? 'scale(1.04)' : 'scale(1)'
            }}>
              {s / 100}
            </button>
          ))}
        </div>

        {/* Toast message */}
        {message && (
          <div style={{
            padding: '8px 12px', borderRadius: '9px', marginBottom: '8px', fontSize: '12px', fontWeight: '600',
            background: message.type === 'success' ? 'rgba(34,197,94,0.12)' : message.type === 'error' ? 'rgba(220,20,60,0.12)' : 'rgba(220,20,60,0.08)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(220,20,60,0.3)'}`,
            color: message.type === 'success' ? '#4ade80' : message.type === 'error' ? '#ff8fa3' : '#ff8fa3',
            animation: 'slideDown 0.3s ease'
          }}>
            {message.text}
          </div>
        )}

        {/* Place Bet / Waiting state */}
        {!ticketPlaced ? (
          <button
            onClick={placeBet}
            disabled={!isBetting || isPlacing || picks.size === 0}
            style={{
              width: '100%', padding: '15px', borderRadius: '13px', cursor: 'pointer',
              background: (!isBetting || picks.size === 0)
                ? 'rgba(255,255,255,0.05)'
                : isPlacing
                ? 'linear-gradient(135deg, #6b0020, #4a0015)'
                : 'linear-gradient(135deg, #dc143c 0%, #c0001e 50%, #8b0000 100%)',
              color: (!isBetting || picks.size === 0) ? '#3a1020' : '#fff',
              fontSize: '15px', fontWeight: '900', letterSpacing: '0.06em',
              boxShadow: isBetting && picks.size > 0 ? '0 4px 24px rgba(220,20,60,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
              transition: 'all 0.2s',
              transform: isBetting && picks.size > 0 && !isPlacing ? 'scale(1.01)' : 'scale(1)',
              border: isBetting && picks.size > 0 ? '1px solid rgba(255,100,120,0.3)' : '1px solid transparent'
            }}>
            {isPlacing
              ? '⏳ Placing Bet...'
              : !isBetting
              ? '⏸ Waiting for Next Round...'
              : picks.size === 0
              ? 'Select Numbers to Play'
              : `🎱 PLACE BET — ${(stake / 100).toFixed(0)} ETB`}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '15px', borderRadius: '13px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#4ade80', fontSize: '14px', fontWeight: '800', textAlign: 'center',
            animation: 'slideDown 0.3s ease'
          }}>
            ✅ Ticket Placed — Waiting for Draw...
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #120008; }
        ::-webkit-scrollbar-thumb { background: rgba(220,20,60,0.3); border-radius: 2px; }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
        @keyframes urgentPulse { 0%,100%{box-shadow:0 0 20px rgba(220,20,60,0.6)} 50%{box-shadow:0 0 32px rgba(220,20,60,1)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ballBounce { 0%{opacity:0;transform:scale(0.3)} 60%{transform:scale(1.2)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}
