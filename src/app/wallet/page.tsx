'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { getMe, getDeposits, getWithdrawals, getTransactions } from '../../lib/api';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import BunaModal from '../../components/BunaModal';
import t from '../../lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  User as UserIcon, 
  CheckCircle, 
  Wallet as WalletIcon, 
  Download,
  Play,
  Trophy,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  XCircle,
  CheckCircle2,
  Gamepad2,
  AlertCircle,
} from 'lucide-react';


export default function WalletPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [agentStats, setAgentStats] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const { socket } = useSocket();
  const [tab, setTab] = useState('balance');
  const [mounted, setMounted] = useState(false);

  // Transaction history state
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all'|'deposits'|'withdrawals'|'games'>('all');

  // Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'confirm' | 'balance';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Native Web Flow Modals


  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const [wdAccName, setWdAccName] = useState('');
  const [wdAccNum, setWdAccNum] = useState('');
  const [isSubmittingWd, setIsSubmittingWd] = useState(false);

  const showAlert = (title: string, message: string, type: any = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };



  const handleWithdrawSubmit = async () => {
    if (!wdAmount || !wdAccName || !wdAccNum) {
      showAlert('ስህተት', 'እባክዎ ሙሉ የወጪ መጠየቂያ መረጃዎችን ያስገቡ።', 'error');
      return;
    }
    setIsSubmittingWd(true);
    try {
      await api.post('/withdrawals', {
        amount: wdAmount,
        bankName: 'Telebirr',
        accountName: wdAccName,
        accountNumber: wdAccNum
      });
      setShowWithdrawModal(false);
      setWdAmount(''); setWdAccName(''); setWdAccNum('');
      showAlert('ተሳክቷል', 'የወጪ ጥያቄዎ በተሳካ ሁኔታ ቀርቧል። የኤጀንት ማረጋገጫ ይጠብቁ።', 'success');
      loadTxHistory();
    } catch (err: any) {
      showAlert('የወጪ ጥያቄ አልተሳካም', err.response?.data?.error || err.message, 'error');
    } finally {
      setIsSubmittingWd(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    getMe().then(u => {
      setUser(u);
      if (u?.role === 'AGENT' || u?.role === 'agent') {
        api.get('/agent/stats').then(res => setAgentStats(res.data)).catch(() => {});
      }
      if (u?.role === 'ADMIN' || u?.isAdmin) {
        api.get('/admin/analytics').then(res => setAdminStats(res.data)).catch(() => {});
      }
    }).catch(() => { });
  }, []);

  // Load transaction history (called on mount + when tab opens)
  const loadTxHistory = useCallback(async () => {
    setTxLoading(true);
    try {
      const [dep, wd, tx] = await Promise.all([
        getDeposits(),
        getWithdrawals(),
        getTransactions(),
      ]);
      setDeposits(Array.isArray(dep) ? dep : []);
      setWithdrawals(Array.isArray(wd) ? wd : []);
      setTxns(Array.isArray(tx) ? tx : []);
    } catch (_) {}
    setTxLoading(false);
  }, []);

  useEffect(() => {
    loadTxHistory();
  }, [loadTxHistory]);

  // Real-time Updates
  useEffect(() => {
    if (!socket) return;

    socket.on('balance-updated', (data: { newBalance: string }) => {
      setUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          wallet: { ...prev.wallet, balance: parseFloat(data.newBalance) }
        };
      });
    });

    socket.on('bonus-updated', (data: { bonusBalance: string }) => {
      setUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          wallet: { ...prev.wallet, bonusBalance: parseFloat(data.bonusBalance) }
        };
      });
    });

    socket.on('deposit-approved', (data: { amount: string, bonus: string }) => {
      setModal({
        isOpen: true,
        title: t('depositApprovedTitle') as string,
        message: (t('depositApprovedMsg') as (a: string, b: string) => string)(data.amount, data.bonus),
        type: 'success'
      });
    });

    return () => {
      socket.off('balance-updated');
      socket.off('bonus-updated');
      socket.off('deposit-approved');
    };
  }, [socket]);

  if (!mounted) return null;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text, transition: 'all 0.3s ease' }}>
      
      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.gold}` }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: T.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <WalletIcon size={18} color={T.header} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>MY WALLET</div>
         </div>
         <RefreshCw size={20} color={T.gold} onClick={() => window.location.reload()} style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ padding: '20px 15px' }}>
        
        {/* ── Verified User Card ── */}
        <div style={{ background: T.card, padding: '15px', borderRadius: '16px', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <UserIcon size={20} opacity={0.5} />
              </div>
              <div>
                 <div style={{ fontSize: '14px', fontWeight: '900' }}>{user?.firstName} {user?.lastName || ''}</div>
                 <div style={{ fontSize: '11px', opacity: 0.5 }}>{user?.phoneNumber || 'Phone not linked'}</div>
              </div>
           </div>
           {user?.phoneNumber && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(76,175,80,0.1)', color: '#4CAF50', padding: '4px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '900' }}>
                <CheckCircle size={12} /> VERIFIED
             </div>
           )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <div 
              onClick={() => setTab('balance')}
              style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: tab === 'balance' ? T.gold : 'transparent', color: tab === 'balance' ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: tab === 'balance' ? 'none' : `1px solid ${T.border}` }}
           >
              Main Balance
           </div>
           <div 
              onClick={() => setTab('history')}
              style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: tab === 'history' ? T.gold : 'transparent', color: tab === 'history' ? T.header : T.text, fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: tab === 'history' ? 'none' : `1px solid ${T.border}` }}
           >
              Transaction History
           </div>
        </div>

        {tab === 'balance' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* ── Main Balance Card ── */}
            <div style={{ background: T.header, color: 'white', padding: '25px', borderRadius: '24px', border: `2px solid ${T.gold}`, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
               <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.6, marginBottom: '5px' }}>AVAILABLE BALANCE</div>
               <div style={{ fontSize: '42px', fontWeight: '900', color: T.gold }}>{Number(user?.wallet?.balance ?? 0).toFixed(2)} <span style={{ fontSize: '18px', opacity: 0.5 }}>ETB</span></div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '25px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <div>
                     <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px' }}>BONUS BALANCE</div>
                     <div style={{ fontSize: '18px', fontWeight: '900' }}>{Number(user?.wallet?.bonusBalance ?? 0).toFixed(2)} <span style={{ fontSize: '11px', opacity: 0.3 }}>ETB</span></div>
                  </div>
                  <div>
                     <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px' }}>TOTAL COINS</div>
                     <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold }}>{user?.wallet?.coins ?? 0} <span style={{ fontSize: '11px', opacity: 0.3 }}>XP</span></div>
                  </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '25px' }}>
                  <button 
                    onClick={() => {
                      try {
                        (window as any).Telegram.WebApp.close();
                      } catch (e) {
                        showAlert('ተቀማጭ', 'እባክዎ በቴሌግራም ቦት ላይ የ /deposit ትዕዛዝን ይጠቀሙ።', 'info');
                      }
                    }}
                    style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <ArrowDownLeft size={18} /> Deposit
                  </button>
                  <button 
                    onClick={() => setShowWithdrawModal(true)}
                    style={{ padding: '12px', borderRadius: '12px', background: T.gold, border: 'none', color: T.header, fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <ArrowUpRight size={18} /> Withdraw
                  </button>
               </div>

               <button 
                  onClick={async () => {
                    try {
                      const { convertCoins } = await import('../../lib/api');
                      const res = await convertCoins();
                      if (res.success) {
                        showAlert('በተሳካ ሁኔታ ተቀይሯል', `በተሳካ ሁኔታ ${res.coinsSpent} XP ወደ ${res.bonusEarned} ETB ቦነስ ተቀይሯል!`, 'success');
                        setTimeout(() => window.location.reload(), 2000);
                      }
                    } catch (e: any) {
                      showAlert('ቅየራ አልተሳካም', e.response?.data?.error || 'ለመቀየር ቢያንስ 100 XP ያስፈልጋል።', 'error');
                    }
                  }}
                  style={{ width: '100%', marginTop: '15px', padding: '12px', borderRadius: '12px', background: 'transparent', border: `1px solid ${T.gold}`, color: T.gold, fontWeight: '900', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
               >
                  <Download size={16} /> Convert XP to ETB Bonus
               </button>
            </div>

            {/* ── Admin Platform Health Card ── */}
            {adminStats && (
               <div style={{ marginTop: '25px', background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)', padding: '20px', borderRadius: '24px', border: `2px solid ${T.gold}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: T.gold, textTransform: 'uppercase', letterSpacing: '2px' }}>PLATFORM HEALTH</div>
                    <div style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: '900' }}>
                      LIVE DATA
                    </div>
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: 'white' }}>{Number(adminStats.globalSales ?? 0).toLocaleString()} <span style={{ fontSize: '16px', opacity: 0.5 }}>ETB</span></div>
                  <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px', color: 'white' }}>Total platform-wide ticket sales volume.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div>
                      <div style={{ fontSize: '10px', opacity: 0.5, color: 'white' }}>CO. REVENUE (6.25%)</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: T.gold }}>{Number(adminStats.totalCompanyRevenue ?? 0).toLocaleString()} <span style={{ fontSize: '10px', opacity: 0.3 }}>ETB</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', opacity: 0.5, color: 'white' }}>ACTIVE GAMES</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#4ade80' }}>{adminStats.activeGames} <span style={{ fontSize: '10px', opacity: 0.3 }}>NOW</span></div>
                    </div>
                  </div>
               </div>
            )}

            {/* ── Agent Pre-Deposit Card (if Agent) ── */}
            {agentStats && (
               <div style={{ marginTop: '25px', background: T.card, padding: '20px', borderRadius: '24px', border: `1px solid ${agentStats.preDeposit?.state === 'RED' ? '#ef4444' : agentStats.preDeposit?.state === 'YELLOW' ? '#eab308' : T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.5 }}>AGENT PRE-DEPOSIT</div>
                    <div style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '20px', background: agentStats.preDeposit?.state === 'GREEN' ? 'rgba(34,197,94,0.1)' : agentStats.preDeposit?.state === 'YELLOW' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', color: agentStats.preDeposit?.state === 'GREEN' ? '#22c55e' : agentStats.preDeposit?.state === 'YELLOW' ? '#eab308' : '#ef4444', fontWeight: '900' }}>
                      {agentStats.preDeposit?.state}
                    </div>
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '900' }}>{Number(agentStats.preDeposit?.balance ?? 0).toLocaleString()} <span style={{ fontSize: '16px', opacity: 0.5 }}>ETB</span></div>
                  <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px', lineHeight: '1.4' }}>{agentStats.preDeposit?.message}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px', paddingTop: '15px', borderTop: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: '10px', opacity: 0.5 }}>BRANCH SALES</div>
                      <div style={{ fontSize: '14px', fontWeight: '900' }}>{Number(agentStats.totalSales ?? 0).toLocaleString()} <span style={{ fontSize: '10px', opacity: 0.3 }}>ETB</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', opacity: 0.5 }}>TAKE-HOME (18.75%)</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: T.gold }}>{Number(agentStats.agentTakeHome ?? 0).toLocaleString()} <span style={{ fontSize: '10px', opacity: 0.3 }}>ETB</span></div>
                    </div>
                  </div>
               </div>
            )}

            {/* ── Recent Activity Preview ── */}
            {(() => {
              // Build unified list sorted by date desc
              const allItems = [
                ...deposits.map(d => ({ kind: 'deposit' as const, date: d.createdAt, amount: d.amount, status: d.status, id: d.id })),
                ...withdrawals.map(w => ({ kind: 'withdrawal' as const, date: w.createdAt, amount: w.amount, status: w.status, id: w.id })),
                ...txns.map(t => ({ kind: 'tx' as const, date: t.createdAt, amount: t.amount, status: t.type, id: t.id })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

              const statusColor = (s: string) => {
                if (['APPROVED', 'CREDIT'].includes(s)) return '#22c55e';
                if (['REJECTED'].includes(s)) return '#ef4444';
                if (['DEBIT'].includes(s)) return '#f97316';
                return '#eab308'; // PENDING
              };
              const kindIcon = (k: string) => {
                if (k === 'deposit') return <ArrowDownLeft size={18} />;
                if (k === 'withdrawal') return <ArrowUpRight size={18} />;
                return <Gamepad2 size={18} />;
              };
              const kindLabel = (k: string) => k === 'deposit' ? 'Deposit' : k === 'withdrawal' ? 'Withdrawal' : 'Game';

              return (
                <div style={{ marginTop: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingLeft: '5px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase' }}>Recent Activity</div>
                    <div onClick={() => setTab('history')} style={{ fontSize: '11px', fontWeight: '900', color: T.gold, cursor: 'pointer', opacity: 0.8 }}>View All →</div>
                  </div>
                  {allItems.length === 0 ? (
                    <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '30px 20px', textAlign: 'center' }}>
                      <div style={{ opacity: 0.2, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}><History size={36} /></div>
                      <div style={{ fontSize: '13px', opacity: 0.5 }}>No recent activity yet</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allItems.map((item, i) => (
                        <motion.div key={item.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                          style={{ background: T.card, borderRadius: '14px', border: `1px solid ${T.border}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${statusColor(item.status)}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor(item.status), flexShrink: 0 }}>
                            {kindIcon(item.kind)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '900', fontSize: '13px' }}>{kindLabel(item.kind)}</div>
                            <div style={{ fontSize: '10px', opacity: 0.45, marginTop: '2px' }}>{new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: '900', fontSize: '15px', color: item.kind === 'tx' && item.status === 'DEBIT' ? '#f97316' : '#22c55e' }}>
                              {item.kind === 'tx' && item.status === 'DEBIT' ? '-' : '+'}{Number(item.amount).toFixed(0)}
                              <span style={{ fontSize: '9px', opacity: 0.4 }}> ETB</span>
                            </div>
                            <div style={{ fontSize: '9px', fontWeight: '900', color: statusColor(item.status), marginTop: '2px', textTransform: 'uppercase' }}>{item.status}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        ) : (
          // ── Transaction History Tab ──
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {(['all', 'deposits', 'withdrawals', 'games'] as const).map(f => (
                <div key={f} onClick={() => setHistoryFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '900', fontSize: '11px', textTransform: 'capitalize',
                    background: historyFilter === f ? T.gold : 'transparent',
                    color: historyFilter === f ? T.header : T.text,
                    border: historyFilter === f ? 'none' : `1px solid ${T.border}` }}>
                  {f === 'all' ? 'All' : f === 'deposits' ? '⬇ Deposits' : f === 'withdrawals' ? '⬆ Withdrawals' : '🎮 Games'}
                </div>
              ))}
            </div>

            {txLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                <div style={{ fontSize: '13px' }}>Loading history...</div>
              </div>
            ) : (() => {
              const statusColor = (s: string) => {
                if (['APPROVED', 'CREDIT'].includes(s)) return '#22c55e';
                if (['REJECTED'].includes(s)) return '#ef4444';
                if (['DEBIT'].includes(s)) return '#f97316';
                return '#eab308';
              };
              const statusIcon = (s: string) => {
                if (['APPROVED', 'CREDIT'].includes(s)) return <CheckCircle2 size={13} />;
                if (['REJECTED'].includes(s)) return <XCircle size={13} />;
                if (['PENDING'].includes(s)) return <Clock size={13} />;
                return <AlertCircle size={13} />;
              };

              const allItems = [
                ...(historyFilter === 'all' || historyFilter === 'deposits' ? deposits.map(d => ({ kind: 'deposit' as const, date: d.createdAt, amount: d.amount, status: d.status, id: d.id, note: d.reference || '' })) : []),
                ...(historyFilter === 'all' || historyFilter === 'withdrawals' ? withdrawals.map(w => ({ kind: 'withdrawal' as const, date: w.createdAt, amount: w.amount, status: w.status, id: w.id, note: w.bankName || '' })) : []),
                ...(historyFilter === 'all' || historyFilter === 'games' ? txns.map(t => ({ kind: 'tx' as const, date: t.createdAt, amount: t.amount, status: t.type, id: t.id, note: t.description || 'Game transaction' })) : []),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              if (allItems.length === 0) return (
                <div style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ opacity: 0.2, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}><History size={36} /></div>
                  <div style={{ fontSize: '13px', opacity: 0.5 }}>No transactions found</div>
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allItems.map((item, i) => (
                    <motion.div key={item.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      style={{ background: T.card, borderRadius: '16px', border: `1px solid ${T.border}`, padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                      {/* Icon */}
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${statusColor(item.status)}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor(item.status), flexShrink: 0 }}>
                        {item.kind === 'deposit' ? <ArrowDownLeft size={22} /> : item.kind === 'withdrawal' ? <ArrowUpRight size={22} /> : <Gamepad2 size={22} />}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '900', fontSize: '13px' }}>
                          {item.kind === 'deposit' ? 'Deposit' : item.kind === 'withdrawal' ? 'Withdrawal' : 'Game'}
                        </div>
                        {item.note && <div style={{ fontSize: '10px', opacity: 0.45, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.note}</div>}
                        <div style={{ fontSize: '10px', opacity: 0.35, marginTop: '2px' }}>{new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {/* Amount + status */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: '900', fontSize: '17px', color: item.kind === 'tx' && item.status === 'DEBIT' ? '#f97316' : '#22c55e' }}>
                          {item.kind === 'tx' && item.status === 'DEBIT' ? '-' : '+'}{Number(item.amount).toFixed(0)}
                          <span style={{ fontSize: '10px', opacity: 0.4 }}> ETB</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', marginTop: '3px', fontSize: '9px', fontWeight: '900', color: statusColor(item.status), textTransform: 'uppercase' }}>
                          {statusIcon(item.status)} {item.status}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}

      </div>



      <style dangerouslySetInnerHTML={{ __html: `
        body { background: ${T.bg} !important; margin: 0; padding: 0; transition: background 0.3s ease; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      ` }} />



      {/* ── NATIVE WITHDRAWAL MODAL ── */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 50, scale: 0.9 }} style={{ background: T.header, width: '100%', maxWidth: '400px', borderRadius: '24px', border: `1px solid ${T.gold}`, padding: '24px', color: 'white', position: 'relative', overflowY: 'auto', maxHeight: '90vh' }}>
              <button onClick={() => setShowWithdrawModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)' }}><XCircle size={24} /></button>
              
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: '900', color: T.gold }}>WITHDRAW FUNDS</h2>
              <p style={{ margin: '0 0 20px 0', fontSize: '12px', opacity: 0.6 }}>Request a withdrawal to your Telebirr account.</p>

              <div style={{ background: 'rgba(212,175,55,0.1)', border: `1px solid rgba(212,175,55,0.3)`, padding: '12px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: '900' }}>AVAILABLE BALANCE</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold }}>{Number(user?.wallet?.balance ?? 0).toFixed(2)} ETB</div>
                 </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', opacity: 0.7, marginBottom: '6px' }}>WITHDRAWAL AMOUNT (ETB)</label>
                <input type="number" placeholder="e.g. 1000" value={wdAmount} onChange={e => setWdAmount(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '16px', fontWeight: '900', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', opacity: 0.7, marginBottom: '6px' }}>BANK PROVIDER</label>
                <input type="text" value="Telebirr" disabled style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '16px', fontWeight: '900', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', opacity: 0.7, marginBottom: '6px' }}>ACCOUNT HOLDER NAME</label>
                <input type="text" placeholder="e.g. ABEBE BEKELE" value={wdAccName} onChange={e => setWdAccName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '16px', fontWeight: '900', outline: 'none', textTransform: 'uppercase' }} />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', opacity: 0.7, marginBottom: '6px' }}>ACCOUNT NUMBER</label>
                <input type="text" placeholder="e.g. 0911..." value={wdAccNum} onChange={e => setWdAccNum(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '16px', fontWeight: '900', outline: 'none' }} />
              </div>

              <button onClick={handleWithdrawSubmit} disabled={isSubmittingWd} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: T.gold, color: T.header, border: 'none', fontWeight: '900', fontSize: '16px', opacity: isSubmittingWd ? 0.7 : 1 }}>
                {isSubmittingWd ? 'SUBMITTING...' : 'REQUEST WITHDRAWAL'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BunaModal 
        isOpen={modal.isOpen}
        onClose={() => setModal(p => ({ ...p, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
