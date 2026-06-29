'use client';
/**
 * AVIATOR GAME PAGE — /play/aviator
 * UI replicates the original aviator-crash React app exactly.
 * Socket events use "aviator:" prefix to avoid collision with Bingo.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Unity, { UnityContext } from 'react-unity-webgl';
import { useSocket } from '../../../context/SocketContext';
import { getMe } from '../../../lib/api';
import { initTelegram } from '../../../lib/telegram';

// unityContext is created inside the component via useState (lazy init).
// See AviatorPage below — this prevents the Unity onwheel null crash on re-mount.

// ── Types ─────────────────────────────────────────────────────────────────────
type GamePhase = 'WAIT' | 'BET' | 'PLAY' | 'ENDED' | '';
type GameType  = 'manual' | 'auto';

interface GameState {
  GameState:  GamePhase;
  currentNum: number;
  time:       number;
}
interface BettedUser {
  name:       string;
  betAmount:  number;
  cashOut:    number;
  cashouted:  boolean;
  target:     number;
  img:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function multiplierColor(x: number) {
  if (x < 2)  return '#ff4444';
  if (x < 5)  return '#ffaa00';
  if (x < 10) return '#44cc44';
  return '#aa44ff';
}

// ── Bet Panel ─────────────────────────────────────────────────────────────────
function BetPanel({
  slot, gameState, balance, socket, userId, showToast,
}: {
  slot:       'f' | 's';
  gameState:  GameState;
  balance:    number;
  socket:     any;
  userId:     string;
  showToast:  (msg: string, ok: boolean) => void;
}) {
  const [gameType, setGameType]   = useState<GameType>('manual');
  const [betAmount, setBetAmount] = useState(20);
  const [cashOutAt, setCashOutAt] = useState(2.00);
  const [autoCashout, setAutoCashout] = useState(false);
  const [hasBet, setHasBet]       = useState(false);
  const [cashedOut, setCashedOut] = useState(false);

  const phase = gameState.GameState;
  const mult  = parseFloat((gameState.currentNum ?? 1).toFixed(2));

  // Reset on new round
  useEffect(() => {
    if (phase === 'BET') { setHasBet(false); setCashedOut(false); }
  }, [phase]);

  const presets = [20, 50, 100, 1000];

  const placeBet = () => {
    if (!socket || hasBet || phase !== 'BET') return;
    socket.emit('aviator:playBet', {
      betAmount,
      target: autoCashout ? cashOutAt : 0,
      type:   slot,
      auto:   autoCashout,
    });
    setHasBet(true);
    showToast(`Bet ${betAmount} ETB placed!`, true);
  };

  const doCashOut = () => {
    if (!socket || !hasBet || cashedOut || phase !== 'PLAY') return;
    socket.emit('aviator:cashOut', { endTarget: mult, type: slot });
    setCashedOut(true);
    showToast(`Cashed out at ${mult}×!`, true);
  };

  const canBet     = phase === 'BET' && !hasBet;
  const canCashout = phase === 'PLAY' && hasBet && !cashedOut;

  return (
    <div style={{
      flex: 1,
      background: '#1a1a2e',
      borderRadius: '10px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: 0,
    }}>
      {/* Bet / Auto tabs */}
      <div style={{ display: 'flex', borderRadius: '20px', background: '#111', padding: '2px', gap: '2px' }}>
        {(['manual', 'auto'] as GameType[]).map(t => (
          <button key={t} onClick={() => setGameType(t)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: '18px', border: 'none',
              background: gameType === t ? '#fff' : 'transparent',
              color:      gameType === t ? '#111' : 'rgba(255,255,255,0.5)',
              fontWeight: '700', fontSize: '11px', cursor: 'pointer',
            }}>
            {t === 'manual' ? 'Bet' : 'Auto'}
          </button>
        ))}
      </div>

      {/* Amount row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => setBetAmount(a => Math.max(5, a - 1))}
          disabled={hasBet}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '16px',
            cursor: hasBet ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
          }}>−</button>
        <input
          type="number" value={betAmount} disabled={hasBet}
          onChange={e => setBetAmount(Math.max(5, parseInt(e.target.value) || 5))}
          style={{
            flex: 1, minWidth: 0, textAlign: 'center', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
            color: '#fff', fontWeight: '900', fontSize: '14px', padding: '4px 0', outline: 'none',
          }}
        />
        <button
          onClick={() => setBetAmount(a => Math.min(balance, a + 1))}
          disabled={hasBet}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '16px',
            cursor: hasBet ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
          }}>+</button>
      </div>

      {/* Preset amounts */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {presets.map(p => (
          <button key={p} onClick={() => !hasBet && setBetAmount(p)} style={{
            flex: 1, padding: '4px 0', borderRadius: '4px', border: 'none',
            background: betAmount === p ? 'rgba(255,60,60,0.3)' : 'rgba(255,255,255,0.07)',
            color: betAmount === p ? '#ff6666' : 'rgba(255,255,255,0.5)',
            fontSize: '10px', fontWeight: '700', cursor: hasBet ? 'not-allowed' : 'pointer',
          }}>{p}</button>
        ))}
      </div>

      {/* Auto cashout row */}
      {gameType === 'auto' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox" checked={autoCashout} onChange={e => setAutoCashout(e.target.checked)}
            style={{ accentColor: '#2ecc71', width: '14px', height: '14px', cursor: 'pointer' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', whiteSpace: 'nowrap' }}>Auto Cash Out @</span>
          <input
            type="number" step="0.01" min="1.01" value={cashOutAt}
            onChange={e => setCashOutAt(parseFloat(e.target.value) || 2)}
            style={{
              width: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px',
              color: '#fff', fontWeight: '700', fontSize: '13px', padding: '3px 4px', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Action button */}
      {!hasBet ? (
        <button onClick={placeBet} disabled={!canBet} style={{
          width: '100%', padding: '12px 0', borderRadius: '8px', border: 'none',
          background: canBet ? 'linear-gradient(180deg,#3cde3c,#23a823)' : 'rgba(255,255,255,0.08)',
          color: '#fff', fontWeight: '900', fontSize: '14px',
          cursor: canBet ? 'pointer' : 'not-allowed',
          boxShadow: canBet ? '0 3px 0 #1a7a1a' : 'none',
          transition: 'all 0.15s',
        }}>
          {phase === 'BET'
            ? <><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>BET</div><div>{betAmount.toFixed(2)} ETB</div></>
            : <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Waiting for next round</div>
          }
        </button>
      ) : cashedOut ? (
        <div style={{
          width: '100%', padding: '12px 0', borderRadius: '8px', textAlign: 'center',
          background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.4)',
          color: '#2ecc71', fontWeight: '900', fontSize: '12px',
        }}>✅ Cashed out! Wait for next round...</div>
      ) : (
        <button onClick={doCashOut} disabled={!canCashout} style={{
          width: '100%', padding: '12px 0', borderRadius: '8px', border: 'none',
          background: canCashout ? 'linear-gradient(180deg,#ff4444,#cc2222)' : 'rgba(255,255,255,0.08)',
          color: '#fff', fontWeight: '900', fontSize: '12px',
          cursor: canCashout ? 'pointer' : 'not-allowed',
          boxShadow: canCashout ? '0 3px 0 #881111' : 'none',
          transition: 'all 0.15s',
        }}>
          {canCashout
            ? <><div>CASH OUT</div><div style={{ fontSize: '11px' }}>{(betAmount * mult).toFixed(2)} ETB</div></>
            : <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                {phase === 'BET' ? 'Waiting for next round' : hasBet ? 'Waiting for flight...' : 'Place your bet first'}
              </div>
          }
        </button>
      )}

      {hasBet && !cashedOut && phase === 'PLAY' && (
        <button onClick={() => { setHasBet(false); showToast('Cancelled', false); }} style={{
          width: '100%', padding: '6px 0', borderRadius: '6px',
          background: 'rgba(255,60,60,0.15)', border: '1px solid rgba(255,60,60,0.3)',
          color: '#ff6666', fontWeight: '700', fontSize: '11px', cursor: 'pointer',
        }}>CANCEL</button>
      )}
    </div>
  );
}

// ── History pill ──────────────────────────────────────────────────────────────
function HistoryPill({ x }: { x: number }) {
  const color = multiplierColor(x);
  return (
    <span style={{
      display: 'inline-block',
      background: color + '22',
      border: `1px solid ${color}66`,
      color, borderRadius: '10px',
      padding: '2px 8px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap',
    }}>{x.toFixed(2)}×</span>
  );
}

// ── All Bets table ────────────────────────────────────────────────────────────
function BetsTable({ users }: { users: BettedUser[] }) {
  const [tab, setTab] = useState<'all' | 'top'>('all');
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center' }}>
        {(['all', 'top'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '5px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#fff' : 'rgba(255,255,255,0.07)',
            color:      tab === t ? '#111' : 'rgba(255,255,255,0.5)',
            fontWeight: '700', fontSize: '11px',
          }}>{t === 'all' ? 'All Bets' : 'Top'}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '2px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px', padding: '0 4px' }}>
        <span>User</span><span style={{ textAlign: 'center' }}>Bet, ETB</span><span style={{ textAlign: 'right' }}>Cash out</span>
      </div>
      {users.length === 0 && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>No bets yet</div>}
      {[...users]
        .sort(tab === 'top' ? (a, b) => b.cashOut - a.cashOut : () => 0)
        .map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '2px', padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name?.slice(0, 10) || 'Player'}
            </span>
            <span style={{ textAlign: 'center', color: '#f1c40f', fontWeight: '700' }}>{u.betAmount}</span>
            <span style={{ textAlign: 'right', color: u.cashouted ? '#2ecc71' : 'rgba(255,255,255,0.3)', fontWeight: '700' }}>
              {u.cashouted ? `${u.cashOut.toFixed(2)}×` : '—'}
            </span>
          </div>
        ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AviatorPage() {
  const router = useRouter();
  const { socket } = useSocket();

  // ── Unity context: lazy per-mount creation ─────────────────────────────────
  // CRITICAL: Must NOT be at module level. Each React mount creates a fresh
  // UnityContext. If reused across unmount/remount, Unity's WASM loop calls
  // canvas.onwheel on a null/stale canvas => visible TypeError crash.
  const [unityCtx] = useState<UnityContext | null>(() => {
    if (typeof window === 'undefined') return null;
    return new UnityContext({
      loaderUrl:    '/unity/AirCrash.loader.js',
      dataUrl:      '/api/unity/AirCrash.data.unityweb',
      frameworkUrl: '/api/unity/AirCrash.framework.js.unityweb',
      codeUrl:      '/api/unity/AirCrash.wasm.unityweb',
    });
  });

  // Cleanup Unity and suppress the native WebGL unmount crash alert
  useEffect(() => {
    return () => {
      // When leaving the page via soft-navigation, Unity's Emscripten thread often 
      // crashes trying to read 'onwheel' from the destroyed canvas, causing a blocking alert.
      if (typeof window !== 'undefined') {
        const originalAlert = window.alert;
        window.alert = function (msg: any) {
          if (typeof msg === 'string' && msg.includes('An error occurred running the Unity content')) {
            console.warn('Suppressed Unity unmount crash alert:', msg);
            return;
          }
          originalAlert(msg);
        };
        // Restore alert after Unity fully dies in the background
        setTimeout(() => { window.alert = originalAlert; }, 2000);
      }

      if (unityCtx && typeof unityCtx.quitUnityInstance === 'function') {
        try { unityCtx.quitUnityInstance(); } catch (e) { /* ignore */ }
      }
    };
  }, [unityCtx]);

  // ── Double-RAF canvas mount delay ───────────────────────────────────────────
  // Ensures the canvas div has real pixel dimensions before Unity WebGL init.
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    let rafId1: number;
    let rafId2: number;
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => setCanvasReady(true));
    });
    return () => { cancelAnimationFrame(rafId1); cancelAnimationFrame(rafId2); };
  }, []);

  // Unity loading
  const [isLoaded, setIsLoaded]               = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Track progress to fire fallback timer
  const progressRef = useRef(0);

  useEffect(() => {
    if (!unityCtx) return;

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const clearFallback = () => {
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    };

    const forceLoaded = () => { setIsLoaded(true); setLoadingProgress(1); };

    const onProgress = (p: number) => {
      progressRef.current = p;
      setLoadingProgress(p);
      if (p >= 0.9) {
        // Unity always stops at 90% while WASM compiles.
        // If neither 'loaded' nor GameController 'Ready' fires within 3s, force-unlock.
        clearFallback();
        fallbackTimer = setTimeout(forceLoaded, 3000);
      }
      if (p === 1) forceLoaded();
    };

    const onLoaded = () => { clearFallback(); forceLoaded(); };

    const onGameReady = (msg: string) => {
      if (msg === 'Ready') { clearFallback(); forceLoaded(); }
    };

    unityCtx.on('progress',       onProgress);
    unityCtx.on('loaded',         onLoaded);
    unityCtx.on('GameController', onGameReady);

    return () => {
      clearFallback();
      if (unityCtx && typeof (unityCtx as any).removeEventListener === 'function') {
        (unityCtx as any).removeEventListener('progress',       onProgress);
        (unityCtx as any).removeEventListener('loaded',         onLoaded);
        (unityCtx as any).removeEventListener('GameController', onGameReady);
      }
    };
  }, [unityCtx]);

  // Game state
  const [userId, setUserId]         = useState('');
  const [balance, setBalance]       = useState(0);
  const [gameState, setGameState]   = useState<GameState>({ GameState: '', currentNum: 1, time: 0 });
  const [history, setHistory]       = useState<number[]>([]);
  const [bettedUsers, setBettedUsers] = useState<BettedUser[]>([]);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [htpLang, setHtpLang]             = useState<'en' | 'am'>('en');

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Unity flag sync (matches original aviator-crash source exactly) ───────────
  // GameManager.RequestToken({ gameState: N }) where:
  //   1 = BET / waiting
  //   2 = PLAY started (multiplier 1.00–2.00)
  //   3 = PLAY multiplier >2
  //   4 = PLAY multiplier >10
  //   5 = ENDED / crashed
  const unityFlagRef  = useRef(0);
  const prevPhaseRef  = useRef('');

  const sendFlag = useCallback((flag: number) => {
    if (!unityCtx || flag === unityFlagRef.current) return;
    unityFlagRef.current = flag;
    try {
      unityCtx.send('GameManager', 'RequestToken', JSON.stringify({ gameState: flag }));
    } catch (e) { /* Unity not ready yet */ }
  }, [unityCtx]);

  useEffect(() => {
    if (!isLoaded) return;
    const { GameState: phase, currentNum } = gameState;
    const m = parseFloat((currentNum ?? 1).toFixed(2));

    if (phase === 'BET' || phase === 'WAIT') {
      sendFlag(1);
    } else if (phase === 'PLAY') {
      if (m > 10)      sendFlag(4);
      else if (m > 2)  sendFlag(3);
      else             sendFlag(2);
    } else if (phase === 'ENDED') {
      sendFlag(5);
    }

    prevPhaseRef.current = phase;
  }, [isLoaded, gameState, sendFlag]);

  // Init user
  useEffect(() => {
    initTelegram();
    let uid = '';
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id)
      uid = String((window as any).Telegram.WebApp.initDataUnsafe.user.id);
    getMe().then(me => {
      if (!me) return;
      if (!uid) uid = me.telegramId ?? me.id ?? '';
      setBalance(parseFloat(me.wallet?.balance ?? '0') + parseFloat(me.wallet?.bonusBalance ?? '0'));
      setUserId(uid);
    }).catch(() => {});
  }, []);

  // Socket
  useEffect(() => {
    if (!socket || !userId) return;
    socket.emit('aviator:enterRoom', { userId });
    socket.on('gameState',      (s: GameState)    => setGameState(s));
    socket.on('bettedUserInfo', (u: BettedUser[]) => setBettedUsers(u));
    socket.on('history',        (h: number[])      => setHistory(h.slice(0, 25)));
    socket.on('success',        (msg: string)      => showToast(msg, true));
    socket.on('aviator:error',  (d: any)           => showToast(d?.message ?? 'Error', false));
    socket.on('balance-updated', (d: any)          => setBalance(parseFloat(d.newBalance)));
    socket.on('myInfo',         (u: any)           => setBalance(parseFloat((u.balance ?? 0).toString())));
    return () => {
      ['gameState','bettedUserInfo','history','success','aviator:error','balance-updated','myInfo']
        .forEach(e => socket.off(e));
    };
  }, [socket, userId, showToast]);

  const phase = gameState.GameState;
  const mult  = parseFloat((gameState.currentNum ?? 1).toFixed(2));

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f1a', color: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Outfit', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { background: #0f0f1a !important; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* ── How To Play Modal ── */}
      {showHowToPlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setShowHowToPlay(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1a1a2e', borderRadius: '18px 18px 0 0',
            width: '100%', maxWidth: '520px', maxHeight: '90vh',
            overflowY: 'auto', padding: '0 0 24px 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px',
              background: 'rgba(229,11,30,0.15)',
              borderBottom: '1px solid rgba(229,11,30,0.2)',
            }}>
              <div style={{ fontWeight: '900', fontSize: '16px', color: '#e50b1e', letterSpacing: '1px' }}>
                ✈️ HOW TO PLAY?
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Language toggle */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2px' }}>
                  <button onClick={() => setHtpLang('en')} style={{
                    background: htpLang === 'en' ? '#e50b1e' : 'transparent',
                    border: 'none', borderRadius: '18px', padding: '4px 12px',
                    color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  }}>EN</button>
                  <button onClick={() => setHtpLang('am')} style={{
                    background: htpLang === 'am' ? '#e50b1e' : 'transparent',
                    border: 'none', borderRadius: '18px', padding: '4px 12px',
                    color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  }}>አማ</button>
                </div>
                <button onClick={() => setShowHowToPlay(false)} style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                  width: '28px', height: '28px', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                }}>✕</button>
              </div>
            </div>

            {/* YouTube Video */}
            <div style={{ padding: '14px 16px 8px' }}>
              <div style={{
                position: 'relative', width: '100%', paddingBottom: '56.25%',
                borderRadius: '12px', overflow: 'hidden', background: '#000',
              }}>
                <iframe
                  src="https://www.youtube.com/embed/PZejs3XDCSY?rel=0&modestbranding=1"
                  title="Aviator How to Play"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    border: 'none',
                  }}
                />
              </div>
              {/* Open in YouTube link */}
              <a
                href="https://youtu.be/PZejs3XDCSY"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  marginTop: '8px', color: '#ff4444', fontSize: '12px', fontWeight: '700',
                  textDecoration: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4444">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                {htpLang === 'am' ? 'ዩቱብ ላይ ክፈት' : 'Watch on YouTube'}
              </a>
            </div>

            {/* Steps */}
            {[
              {
                num: '01',
                icon: '🎰',
                en: 'Place a bet (or two at the same time) and wait for the round to start.',
                am: 'ውርርድ ያቁሙ (ወይም ሁለት በአንድ ጊዜ) እና ዙሩ እስኪጀምር ይጠብቁ።',
              },
              {
                num: '02',
                icon: '✈️',
                en: 'Watch the lucky plane — your win is your bet multiplied by the multiplier. Cash out before the plane flies away!',
                am: 'መልካም እድሉ አውሮፕላን ይከታተሉ — ትርፍዎ ውርርድዎን ብዜት ነው። አውሮፕላኑ ከመብረቁ በፊት ጥሬ ገንዘብ ያውጡ!',
              },
              {
                num: '03',
                icon: '💰',
                en: 'Cash out before the plane flies away and the winnings are yours!',
                am: 'አውሮፕላኑ ከመብረቁ በፊት ጥሬ ገንዘብ ያውጡ እና ሽልማቱ የእርስዎ ነው!',
              },
            ].map(step => (
              <div key={step.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ minWidth: '40px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e50b1e, #ff6b35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '900', fontSize: '13px', color: '#fff',
                  }}>{step.num}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{step.icon}</div>
                  <div style={{ color: '#fff', fontSize: '13px', lineHeight: '1.5', fontWeight: '500' }}>
                    {htpLang === 'am' ? step.am : step.en}
                  </div>
                </div>
              </div>
            ))}

            {/* Footer note */}
            <div style={{
              margin: '16px 16px 0',
              background: 'rgba(229,11,30,0.1)', border: '1px solid rgba(229,11,30,0.2)',
              borderRadius: '10px', padding: '12px 14px',
              color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: '1.6',
            }}>
              {htpLang === 'am'
                ? '⚠️ ዝቅተኛ ውርርድ፡ 5 ETB | ከፍተኛ ውርርድ፡ 5,000 ETB. ሃላፊነት ሊወስዱ በሚችሉበት ደረጃ ብቻ ይጫወቱ።'
                : '⚠️ Min bet: 5 ETB | Max bet: 5,000 ETB. Play responsibly and only bet what you can afford.'}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#27AE60' : '#e74c3c',
          color: '#fff', padding: '8px 18px', borderRadius: '20px',
          zIndex: 9999, fontWeight: '700', fontSize: '13px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          maxWidth: '80vw', textAlign: 'center', whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#141428', borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {/* Aviator logo text */}
        <div style={{ fontWeight: '900', fontSize: '20px', letterSpacing: '-1px' }}>
          <span style={{ color: '#ff3333', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Aviator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => router.push('/')} style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '4px 10px', color: 'rgba(255,255,255,0.6)',
            fontSize: '11px', fontWeight: '700', cursor: 'pointer',
          }}>← Back</button>
          <div style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px', padding: '4px 12px',
            color: '#2ecc71', fontWeight: '900', fontSize: '13px',
          }}>{balance.toFixed(2)} ETB</div>
          {/* How to Play button */}
          <button
            onClick={() => setShowHowToPlay(true)}
            title="How to Play"
            style={{
              background: 'linear-gradient(135deg, #e50b1e, #ff6b35)',
              border: 'none', borderRadius: '50%',
              width: '30px', height: '30px',
              color: '#fff', fontWeight: '900', fontSize: '15px',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(229,11,30,0.5)',
            }}
          >?</button>
        </div>
      </div>

      {/* ── Crash History bar ── */}
      <div style={{
        display: 'flex', gap: '4px', overflowX: 'auto', padding: '5px 10px',
        background: '#141428', borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0, scrollbarWidth: 'none',
      }}>
        {history.length === 0
          ? <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>No history yet</span>
          : history.map((h, i) => <HistoryPill key={i} x={h} />)
        }
      </div>

      {/* ── Unity Game Canvas ── */}
      <div style={{
        position: 'relative', background: '#000',
        flexShrink: 0, height: '42vw', minHeight: '220px', maxHeight: '340px',
        overflow: 'hidden',
      }}>

        {/* Loading overlay always on top until isLoaded */}
        {!isLoaded && (
          <div style={{
            position: 'absolute', inset: 0, background: '#0d0d1c',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <style>{`@keyframes _spin { 100% { transform: rotate(360deg); } }`}</style>
            <div style={{ width: '150px', height: '150px', animation: '_spin 1.5s linear infinite', marginBottom: '15px' }}>
              <img src="/propeller.png" alt="Loading" style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ width: '200px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round(loadingProgress * 100)}%`, height: '100%',
                background: '#e50b1e', borderRadius: '10px', transition: 'width 0.3s',
              }}/>
            </div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '18px', marginTop: '12px' }}>
              {Math.min(100, Math.round(loadingProgress * 100)).toFixed(2)}%
            </div>
          </div>
        )}

        {/*
          Unity canvas — only mounted after double-RAF (canvasReady).
          The original aviator-crash uses the exact same pattern to prevent
          Unity 2021.2+ "onwheel null reference" crash that happens when
          the canvas has 0×0 pixel dimensions during WebGL init.
        */}
        {canvasReady && unityCtx && (
          <Unity
            unityContext={unityCtx}
            matchWebGLToCanvasSize={true}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )}


      </div>

      {/* ── Bet Controls ── */}
      <div style={{
        display: 'flex', gap: '8px', padding: '10px',
        flexShrink: 0, background: '#111122',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <BetPanel slot="f" gameState={gameState} balance={balance} socket={socket} userId={userId} showToast={showToast} />
        <BetPanel slot="s" gameState={gameState} balance={balance} socket={socket} userId={userId} showToast={showToast} />
      </div>

      {/* ── All Bets / Top bets ── */}
      <div style={{
        flex: 1, background: '#0f0f1a', minHeight: '120px',
        borderTop: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <BetsTable users={bettedUsers} />
      </div>
    </div>
  );
}
