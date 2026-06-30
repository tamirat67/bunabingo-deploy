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
const STAKE_PRESETS = [1000, 2000, 5000, 10000, 20000]; // in cents (1 ETB = 100 cents)
const QUICK_PICKS = [1, 2, 3, 4, 5, 6, 8, 10];

export default function FastKenoBoard({ userId }: { userId: string }) {
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [round, setRound] = useState<RoundState | null>(null);
  const [stake, setStake] = useState(500); // 5 ETB default
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastResult, setLastResult] = useState<TicketResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [ticketPlaced, setTicketPlaced] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

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
          }
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
    if (picks.size === 0) {
      setMessage({ text: 'Pick at least 1 number first!', type: 'error' });
      return;
    }
    if (round?.phase !== 'BETTING') {
      setMessage({ text: 'Betting is closed for this round.', type: 'error' });
      return;
    }

    setIsPlacing(true);
    setMessage(null);

    try {
      const initData = typeof window !== 'undefined' ? getTgInitData() : '';
      const res = await fetch('/api/keno/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'x-telegram-init-data': initData } : {}),
        },
        body: JSON.stringify({
          userId,
          picks: Array.from(picks),
          stakeCents: stake,
          idempotencyKey: `keno-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? 'Bet failed. Try again.', type: 'error' });
      } else {
        setTicketPlaced(true);
        setMessage({
          text: `🎱 Ticket placed! ${picks.size} picks for ${(stake / 100).toFixed(0)} ETB`,
          type: 'success',
        });
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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', maxWidth: '500px', margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #1a1040 0%, #0d1f4a 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(99,102,241,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '28px' }}>🎱</div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '18px', background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Fast Keno</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ቡና ቢንጎ | Instant Draw</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#22c55e' : '#ef4444', boxShadow: wsConnected ? '0 0 6px #22c55e' : '0 0 6px #ef4444', animation: wsConnected ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize: '11px', color: wsConnected ? '#86efac' : '#fca5a5' }}>{wsConnected ? 'LIVE' : 'Reconnecting...'}</span>
          </div>
          {round && <span style={{ fontSize: '10px', color: '#64748b' }}>#{round.roundCode}</span>}
        </div>
      </div>

      {/* ── Round Status Bar ── */}
      <div style={{
        padding: '10px 16px',
        background: isBetting ? 'rgba(34,197,94,0.1)' : isDrawing ? 'rgba(234,179,8,0.1)' : isCompleted ? 'rgba(99,102,241,0.1)' : 'rgba(71,85,105,0.1)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{isBetting ? '🟢' : isDrawing ? '🟡' : isCompleted ? '✅' : '⏳'}</span>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: isBetting ? '#4ade80' : isDrawing ? '#facc15' : isCompleted ? '#a78bfa' : '#94a3b8' }}>
              {isBetting ? 'BETTING OPEN' : isDrawing ? 'DRAWING...' : isCompleted ? 'ROUND COMPLETE' : 'Waiting...'}
            </div>
            {isBetting && <div style={{ fontSize: '10px', color: '#94a3b8' }}>Place your picks before time runs out</div>}
          </div>
        </div>
        {isBetting && round && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: round.secondsRemaining <= 2 ? '#ef4444' : '#facc15', fontVariantNumeric: 'tabular-nums' }}>
              {round.secondsRemaining}s
            </div>
          </div>
        )}
      </div>

      {/* ── Last Result ── */}
      {lastResult && isCompleted && (
        <div style={{
          margin: '10px 12px',
          padding: '12px',
          borderRadius: '12px',
          background: (lastResult.payoutCents ?? 0) > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${(lastResult.payoutCents ?? 0) > 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: (lastResult.payoutCents ?? 0) > 0 ? '#4ade80' : '#f87171' }}>
              {(lastResult.payoutCents ?? 0) > 0 ? `🎉 Won! +${((lastResult.payoutCents ?? 0) / 100).toFixed(0)} ETB` : `😔 ${hitCount} hits — try again!`}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{hitCount}/{lastResult.picks.length} hits</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Stake: {(lastResult.stakeCents / 100).toFixed(0)} ETB</span>
            <button
              onClick={() => window.open(`/api/keno/verify/${round?.roundCode}`, '_blank')}
              style={{
                background: 'none', border: 'none', color: '#a78bfa', fontSize: '11px', cursor: 'pointer',
                textDecoration: 'underline', padding: 0
              }}
            >
              🛡️ Provably Fair (Verify)
            </button>
          </div>
        </div>
      )}

      {/* ── Drawn Numbers Strip ── */}
      {(isDrawing || isCompleted) && round && round.drawnNumbers.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Drawn Numbers ({round.drawnNumbers.length}/20)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {round.drawnNumbers.map((n, i) => {
              const isHit = lastResult?.picks.includes(n);
              return (
                <div key={i} style={{
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '700',
                  background: isHit ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(99,102,241,0.3)',
                  color: isHit ? '#fff' : '#c4b5fd',
                  border: isHit ? '1.5px solid #fbbf24' : '1.5px solid rgba(99,102,241,0.4)',
                  boxShadow: isHit ? '0 0 8px rgba(251,191,36,0.5)' : 'none',
                  animation: `ballPop 0.3s ease ${Math.min(i * 0.08, 1.5)}s both`
                }}>
                  {n}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Pick Buttons ── */}
      {isBetting && !ticketPlaced && (
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Pick:</span>
          {QUICK_PICKS.map(n => (
            <button key={n} onClick={() => quickPick(n)} style={{
              position: 'relative',
              padding: '4px 10px', borderRadius: '20px', 
              border: n === 8 ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(99,102,241,0.4)',
              background: n === 8 ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))' : 'rgba(99,102,241,0.15)', 
              color: n === 8 ? '#fcd34d' : '#a78bfa', 
              cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
              boxShadow: n === 8 ? '0 0 10px rgba(245,158,11,0.2)' : 'none'
            }}>
              {n} Spots
              {n === 8 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-4px', background: '#f59e0b', color: '#000',
                  fontSize: '8px', fontWeight: '900', padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase'
                }}>Hot</span>
              )}
            </button>
          ))}
          {picks.size > 0 && (
            <button onClick={() => setPicks(new Set())} style={{
              padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '12px'
            }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Keno Board (80 numbers) ── */}
      <div style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const isPicked = picks.has(n);
            const isDrawn = drawnSet.has(n);
            const isHit = isPicked && isDrawn;
            const canPick = isBetting && !ticketPlaced && (picks.size < MAX_PICKS || isPicked);

            return (
              <button
                key={n}
                onClick={() => togglePick(n)}
                disabled={!canPick && !isPicked}
                style={{
                  height: '34px',
                  width: '100%',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: canPick || isPicked ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  background: isHit
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : isPicked
                    ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                    : isDrawn
                    ? 'rgba(34,197,94,0.35)'
                    : 'rgba(255,255,255,0.06)',
                  color: isPicked || isDrawn ? '#fff' : '#94a3b8',
                  boxShadow: isHit
                    ? '0 0 10px rgba(245,158,11,0.6)'
                    : isPicked
                    ? '0 0 8px rgba(99,102,241,0.5)'
                    : 'none',
                  transform: isPicked ? 'scale(1.05)' : 'scale(1)',
                  opacity: !isBetting && !isDrawn ? 0.5 : 1,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stake + Bet Controls ── */}
      <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Picks indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {picks.size > 0 ? `${picks.size}/${MAX_PICKS} spots selected` : 'Select your spots above'}
          </span>
          {picks.size > 0 && (
            <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '600' }}>
              [{Array.from(picks).sort((a,b)=>a-b).join(', ')}]
            </span>
          )}
        </div>

        {/* Stake presets */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {STAKE_PRESETS.map(s => (
            <button key={s} onClick={() => setStake(s)} style={{
              flex: '1', minWidth: '48px', padding: '7px 4px', borderRadius: '8px', border: 'none',
              background: stake === s ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(255,255,255,0.08)',
              color: stake === s ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
              boxShadow: stake === s ? '0 0 8px rgba(99,102,241,0.5)' : 'none',
              transition: 'all 0.15s'
            }}>
              {s / 100} ETB
            </button>
          ))}
        </div>

        {/* Message toast */}
        {message && (
          <div style={{
            padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '13px',
            background: message.type === 'success' ? 'rgba(34,197,94,0.15)' : message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.4)' : message.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.4)'}`,
            color: message.type === 'success' ? '#4ade80' : message.type === 'error' ? '#f87171' : '#a78bfa',
            animation: 'fadeIn 0.3s ease'
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
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: (!isBetting || picks.size === 0)
                ? 'rgba(255,255,255,0.08)'
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
              color: (!isBetting || picks.size === 0) ? '#4b5563' : '#fff',
              fontSize: '16px', fontWeight: '800', letterSpacing: '0.05em',
              boxShadow: isBetting && picks.size > 0 ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
              transition: 'all 0.2s',
              transform: isBetting && picks.size > 0 ? 'scale(1.01)' : 'scale(1)'
            }}
          >
            {isPlacing ? '⏳ Placing...' : !isBetting ? '⏸ Waiting for next round...' : picks.size === 0 ? 'Select numbers to play' : `🎱 Place Bet — ${(stake / 100).toFixed(0)} ETB`}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
            color: '#4ade80', fontSize: '14px', fontWeight: '700', textAlign: 'center'
          }}>
            ✅ Ticket placed! Waiting for draw...
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ballPop { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0a1a; } ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 2px; }
      `}</style>
    </div>
  );
}
