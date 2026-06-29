'use client';
/**
 * ═══════════════════════════════════════════════════════════
 *  AVIATOR GAME PAGE  —  /play/aviator
 * ═══════════════════════════════════════════════════════════
 *
 * Connects to the same Socket.io server as Bingo (shared socket),
 * but uses "aviator:" prefixed events so there is zero collision.
 *
 * Auth: Telegram WebApp initData passed via the existing
 *       socket userId query param (same as Bingo).
 *
 * Unity WebGL: Serves from /unity/ in the Next.js public folder.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Unity, { UnityContext } from 'react-unity-webgl';

const unityContext = new UnityContext({
  loaderUrl:    '/unity/AirCrash.loader.js',
  dataUrl:      '/unity/AirCrash.data.unityweb',
  frameworkUrl: '/unity/AirCrash.framework.js.unityweb',
  codeUrl:      '/unity/AirCrash.wasm.unityweb',
});

import { ArrowLeft, Wallet as WalletIcon, TrendingUp, Plane, History, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { useSocket } from '../../../context/SocketContext';
import { getMe } from '../../../lib/api';
import { initTelegram } from '../../../lib/telegram';

// ── Types ─────────────────────────────────────────────────

interface GameState {
  GameState: 'WAIT' | 'BET' | 'PLAY' | 'ENDED' | '';
  currentNum: number;
  time: number;
}

interface BettedUser {
  name: string;
  betAmount: number;
  cashOut: number;
  cashouted: boolean;
  target: number;
  img: string;
}

interface HistoryEntry {
  multiplier: number;
}

// ── Helpers ───────────────────────────────────────────────

function getMultiplierColor(x: number): string {
  if (x < 1.5)  return '#e74c3c';
  if (x < 2)    return '#e67e22';
  if (x < 5)    return '#f1c40f';
  if (x < 10)   return '#2ecc71';
  return '#9b59b6';
}

// ── Component ─────────────────────────────────────────────

export default function AviatorPage() {
  const router  = useRouter();
  const { socket } = useSocket();

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgression, setLoadingProgression] = useState(0);

  useEffect(() => {
    const handleProgress = (progression: number) => setLoadingProgression(progression);
    const handleLoaded = () => setIsLoaded(true);

    unityContext.on("progress", handleProgress);
    unityContext.on("loaded", handleLoaded);

    return () => {
      unityContext.removeAllEventListeners();
    };
  }, []);
  // ── State ──────────────────────────────────────────────
  const [userId, setUserId]       = useState('');
  const [balance, setBalance]     = useState(0);
  const [gameState, setGameState] = useState<GameState>({ GameState: '', currentNum: 1, time: 0 });
  const [history, setHistory]     = useState<number[]>([]);
  const [bettedUsers, setBettedUsers] = useState<BettedUser[]>([]);
  const [betAmount, setBetAmount] = useState(20);
  const [targetMultiplier, setTargetMultiplier] = useState(2);
  const [autoCashout, setAutoCashout] = useState(false);
  const [hasBet, setHasBet]       = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<'bet' | 'auto'>('bet');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ───────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Unity multiplier sync ──────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const phase = gameState.GameState;
    const mult  = parseFloat(gameState.currentNum.toFixed(2));

    if (phase === 'PLAY') {
      unityContext.send('GameController', 'SetMultiplier', mult.toString());
      unityContext.send('GameController', 'StartGame', '');
    } else if (phase === 'ENDED') {
      unityContext.send('GameController', 'CrashGame', mult.toString());
    } else if (phase === 'BET') {
      unityContext.send('GameController', 'ResetGame', '');
    }
  }, [isLoaded, gameState]);

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    initTelegram();

    let uid = '';
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      uid = String((window as any).Telegram.WebApp.initDataUnsafe.user.id);
    }

    const load = async () => {
      try {
        const me = await getMe();
        if (me) {
          if (!uid) uid = me.telegramId ?? me.id ?? '';
          const bal = parseFloat(me.wallet?.balance ?? '0') + parseFloat(me.wallet?.bonusBalance ?? '0');
          setBalance(bal);
          setUserId(uid);
        }
      } catch (_) {}
    };
    load();
  }, []);

  // ── Socket events ──────────────────────────────────────
  useEffect(() => {
    if (!socket || !userId) return;

    // Enter the Aviator room
    socket.emit('aviator:enterRoom', { userId });

    socket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.GameState === 'BET') {
        // New round — reset bet tracking
        setHasBet(false);
        setCashedOut(false);
      }
    });

    socket.on('myInfo', (user: any) => {
      setBalance(parseFloat((user.balance ?? 0).toString()));
    });

    socket.on('bettedUserInfo', (users: BettedUser[]) => {
      setBettedUsers(users);
    });

    socket.on('history', (hist: number[]) => {
      setHistory(hist.slice(0, 20));
    });

    socket.on('success', (msg: string) => {
      showToast(msg, 'success');
      setCashedOut(true);
    });

    socket.on('aviator:error', (data: { message: string }) => {
      showToast(data.message ?? 'Something went wrong', 'error');
      setHasBet(false);
    });

    socket.on('balance-updated', (data: { newBalance: string }) => {
      setBalance(parseFloat(data.newBalance));
    });

    return () => {
      socket.off('gameState');
      socket.off('myInfo');
      socket.off('bettedUserInfo');
      socket.off('history');
      socket.off('success');
      socket.off('aviator:error');
      socket.off('balance-updated');
    };
  }, [socket, userId, showToast]);

  // ── Actions ────────────────────────────────────────────
  const placeBet = () => {
    if (!socket || hasBet) return;
    if (gameState.GameState !== 'BET') {
      showToast('ቆይ — ቅነሳ ጊዜ ብቻ ቁልፍ ይሰራል', 'error');
      return;
    }
    socket.emit('aviator:playBet', {
      betAmount,
      target: autoCashout ? targetMultiplier : 0,
      type: 'f',
      auto: autoCashout,
    });
    setHasBet(true);
    showToast(`${betAmount} ETB ቁማር ቀርቧል!`, 'success');
  };

  const cashOut = () => {
    if (!socket || !hasBet || cashedOut) return;
    if (gameState.GameState !== 'PLAY') {
      showToast('የ Cash Out ጊዜ አልደረሰም', 'error');
      return;
    }
    socket.emit('aviator:cashOut', {
      endTarget: parseFloat(gameState.currentNum.toFixed(2)),
      type: 'f',
    });
  };

  // ── Phase-specific button text ─────────────────────────
  const phase = gameState.GameState;
  const mult  = parseFloat((gameState.currentNum ?? 1).toFixed(2));

  const canBet     = phase === 'BET' && !hasBet;
  const canCashout = phase === 'PLAY' && hasBet && !cashedOut;

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #111827 100%)',
      fontFamily: "'Outfit', sans-serif",
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '10px',
    }}>

      {/* ── Google Font ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { background: #0a0e1a !important; margin: 0; padding: 0; }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#27AE60' : '#e74c3c',
          color: '#fff', padding: '10px 20px', borderRadius: '12px',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', fontWeight: '700', fontSize: '13px',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={() => router.push('/')} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px',
          padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900', fontSize: '18px' }}>
          <Plane size={20} color="#e74c3c" />
          AVIATOR
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.3)',
          borderRadius: '8px', padding: '5px 10px', fontSize: '13px', fontWeight: '900', color: '#2ecc71',
        }}>
          <WalletIcon size={14} />
          {balance.toFixed(2)} ETB
        </div>
      </div>

      {/* ── History bar ── */}
      <div style={{
        display: 'flex', gap: '5px', overflowX: 'auto', padding: '8px 12px',
        background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {history.length === 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', padding: '2px 0' }}>ታሪክ የለም</span>
        )}
        {history.map((h, i) => (
          <div key={i} style={{
            background: getMultiplierColor(h) + '22',
            border: `1px solid ${getMultiplierColor(h)}55`,
            color: getMultiplierColor(h),
            padding: '3px 8px', borderRadius: '6px',
            fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {h.toFixed(2)}×
          </div>
        ))}
      </div>

      {/* ── Unity Canvas / Crash Display ── */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #0d1b2a 0%, #1a0a2e 100%)',
        minHeight: '220px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        borderBottom: '2px solid rgba(231,76,60,0.3)',
      }}>
        {/* Loading overlay */}
        {!isLoaded && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 10,
          }}>
            <Plane size={40} color="#e74c3c" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#fff', fontWeight: '900', fontSize: '16px' }}>Loading Aviator...</div>
            <div style={{
              width: '200px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.round(loadingProgression * 100)}%`,
                height: '100%', background: 'linear-gradient(90deg, #e74c3c, #e67e22)',
                borderRadius: '3px', transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              {Math.round(loadingProgression * 100)}%
            </div>
          </div>
        )}

        <Unity unityContext={unityContext} style={{ width: '100%', height: '220px' }} />

        {/* Live multiplier overlay */}
        {(phase === 'PLAY' || phase === 'ENDED') && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: '52px', fontWeight: '900',
              color: phase === 'ENDED' ? '#e74c3c' : getMultiplierColor(mult),
              textShadow: `0 0 30px ${phase === 'ENDED' ? '#e74c3c' : getMultiplierColor(mult)}`,
              lineHeight: 1,
            }}>
              {mult.toFixed(2)}×
            </div>
            {phase === 'ENDED' && (
              <div style={{ color: '#e74c3c', fontWeight: '900', fontSize: '14px', marginTop: '4px', letterSpacing: '2px' }}>
                💥 CRASHED!
              </div>
            )}
          </div>
        )}

        {/* Waiting overlay */}
        {phase === 'WAIT' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'rgba(10,14,26,0.6)',
          }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>
              ⏳ ቀጣይ ጨዋታ እየተዘጋጀ ነው...
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'BET' && (
          <div style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)',
            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#e74c3c',
          }}>
            ✅ ቁማር ጊዜ!
          </div>
        )}
      </div>

      {/* ── Players toggle ── */}
      <button
        onClick={() => setShowUsers(v => !v)}
        style={{
          background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '700', padding: '6px 16px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
        }}
      >
        <Users size={14} /> {bettedUsers.length} ተጫዋቾች {showUsers ? '▲' : '▼'}
      </button>

      {/* ── Betted users list ── */}
      {showUsers && (
        <div style={{
          maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {bettedUsers.map((u, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 16px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                {u.name.slice(0, 8)}...
              </span>
              <span style={{ color: '#f1c40f', fontWeight: '900' }}>{u.betAmount} ETB</span>
              {u.cashouted ? (
                <span style={{ color: '#2ecc71', fontWeight: '900' }}>✅ {u.cashOut.toFixed(2)}×</span>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>⏳</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Bet Controls ── */}
      <div style={{ padding: '14px 14px 0', flex: 1 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
          {(['bet', 'auto'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: '900', fontSize: '12px', letterSpacing: '0.5px',
              background: activeTab === tab ? 'rgba(231,76,60,0.25)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab ? '#e74c3c' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === tab ? '2px solid #e74c3c' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
              {tab === 'bet' ? '🎯 ቁማር' : '🤖 አውቶ'}
            </button>
          ))}
        </div>

        {/* Bet Amount */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: '700' }}>
            የቁማር መጠን (ETB)
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[5, 10, 20, 50, 100].map(v => (
              <button key={v} onClick={() => setBetAmount(v)} style={{
                flex: 1, padding: '8px 0', borderRadius: '8px', cursor: 'pointer',
                background: betAmount === v ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.06)',
                color: betAmount === v ? '#e74c3c' : 'rgba(255,255,255,0.6)',
                fontWeight: '900', fontSize: '12px',
                border: betAmount === v ? '1px solid rgba(231,76,60,0.5)' : '1px solid transparent',
              }}>
                {v}
              </button>
            ))}
          </div>
          <input
            type="number" min={5} max={5000} value={betAmount}
            onChange={e => setBetAmount(Math.max(5, parseInt(e.target.value) || 5))}
            style={{
              marginTop: '8px', width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#fff', padding: '8px 12px',
              fontSize: '14px', fontWeight: '700', outline: 'none',
            }}
          />
        </div>

        {/* Auto-cashout target (shown in both tabs) */}
        {activeTab === 'auto' && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', fontWeight: '700' }}>
              አውቶ ካሽ-አውት ×
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[1.5, 2, 3, 5, 10].map(v => (
                <button key={v} onClick={() => { setTargetMultiplier(v); setAutoCashout(true); }} style={{
                  flex: 1, padding: '8px 0', borderRadius: '8px', cursor: 'pointer',
                  background: targetMultiplier === v && autoCashout ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.06)',
                  color: targetMultiplier === v && autoCashout ? '#2ecc71' : 'rgba(255,255,255,0.6)',
                  fontWeight: '900', fontSize: '12px',
                  border: targetMultiplier === v && autoCashout ? '1px solid rgba(46,204,113,0.5)' : '1px solid transparent',
                }}>
                  {v}×
                </button>
              ))}
            </div>
            <input
              type="number" min={1.1} max={100} step={0.1} value={targetMultiplier}
              onChange={e => { setTargetMultiplier(parseFloat(e.target.value) || 2); setAutoCashout(true); }}
              style={{
                marginTop: '8px', width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#fff', padding: '8px 12px',
                fontSize: '14px', fontWeight: '700', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <input
                type="checkbox" id="autocashout" checked={autoCashout}
                onChange={e => setAutoCashout(e.target.checked)}
                style={{ accentColor: '#2ecc71', width: '15px', height: '15px' }}
              />
              <label htmlFor="autocashout" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                አውቶ ካሽ-አውት አስቃኝ
              </label>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!hasBet ? (
          <button onClick={placeBet} disabled={!canBet} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: canBet
              ? 'linear-gradient(90deg, #e74c3c, #c0392b)'
              : 'rgba(255,255,255,0.08)',
            color: canBet ? '#fff' : 'rgba(255,255,255,0.3)',
            fontWeight: '900', fontSize: '16px', cursor: canBet ? 'pointer' : 'not-allowed',
            boxShadow: canBet ? '0 4px 0 #922b21, 0 0 20px rgba(231,76,60,0.3)' : 'none',
            transition: 'all 0.2s', letterSpacing: '0.5px',
          }}>
            {phase === 'BET'   ? `✈️ ቁማር — ${betAmount} ETB` :
             phase === 'PLAY'  ? '⏳ ሚቀጥለው ዙር...' :
             phase === 'WAIT'  ? '⏳ ሚቀጥለው ዙር...' :
             phase === 'ENDED' ? '⏳ ሚቀጥለው ዙር...' :
             '⏳ ጠብቅ...'}
          </button>
        ) : !cashedOut ? (
          <button onClick={cashOut} disabled={!canCashout} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: canCashout
              ? `linear-gradient(90deg, #27AE60, #1e8449)`
              : 'rgba(255,255,255,0.08)',
            color: canCashout ? '#fff' : 'rgba(255,255,255,0.4)',
            fontWeight: '900', fontSize: '16px', cursor: canCashout ? 'pointer' : 'not-allowed',
            boxShadow: canCashout ? '0 4px 0 #145a32, 0 0 20px rgba(39,174,96,0.4)' : 'none',
            transition: 'all 0.2s',
          }}>
            {canCashout
              ? `💰 ካሽ-አውት — ${(betAmount * mult).toFixed(2)} ETB (${mult}×)`
              : '⏳ ጠብቅ...'}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '14px', borderRadius: '12px', textAlign: 'center',
            background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.3)',
            color: '#2ecc71', fontWeight: '900', fontSize: '15px',
          }}>
            ✅ ካሽ አውት ተደርጓል! ቀጣይ ዙር ይጠብቁ...
          </div>
        )}

        {/* Quick stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <History size={14} color="rgba(255,255,255,0.4)" />
            <div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>አማካኝ Crash</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#f1c40f' }}>
                {history.length ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(2) : '—'}×
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <TrendingUp size={14} color="rgba(255,255,255,0.4)" />
            <div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>ከፍተኛ</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#9b59b6' }}>
                {history.length ? Math.max(...history).toFixed(2) : '—'}×
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spin CSS for loading icon */}
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
