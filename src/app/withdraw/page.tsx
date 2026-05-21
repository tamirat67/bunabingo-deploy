'use client';
import React, { useEffect, useState } from 'react';
import api, { getMe } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { 
  ArrowLeft, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Banknote,
  Smartphone,
  User as UserIcon,
  Play,
  Trophy,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WithdrawPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('Telebirr');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getMe().then(setUser).catch(() => router.push('/'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/withdrawals', {
        amount: parseFloat(amount),
        bankName,
        accountNumber,
        accountName
      });

      if (res.data.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit withdrawal request');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (success) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: T.text }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: '80px', height: '80px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <CheckCircle2 size={48} color="#22c55e" />
        </motion.div>
        <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>Request Submitted!</h2>
        <p style={{ opacity: 0.6, marginBottom: '30px', fontSize: '14px', lineHeight: '1.6' }}>
          Your withdrawal request for <b>{amount} ETB</b> has been received. It is now pending approval by your branch agent.
        </p>
        <button 
          onClick={() => router.push('/wallet')}
          style={{ width: '100%', padding: '16px', borderRadius: '16px', background: T.gold, border: 'none', color: T.header, fontWeight: '900', fontSize: '16px' }}
        >
          Back to Wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Outfit', sans-serif", color: T.text }}>
      
      {/* ── Header ── */}
      <div style={{ background: T.header, padding: '15px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: `2px solid ${T.gold}` }}>
        <ArrowLeft onClick={() => router.back()} style={{ cursor: 'pointer' }} color={T.gold} />
        <div style={{ fontSize: '18px', fontWeight: '900', color: T.gold, letterSpacing: '0.5px' }}>WITHDRAW FUNDS</div>
      </div>

      <div style={{ padding: '20px 15px' }}>
        
        {/* ── Balance Summary ── */}
        <div style={{ background: T.header, padding: '20px', borderRadius: '20px', border: `1px solid ${T.gold}`, marginBottom: '25px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.5, color: 'white', marginBottom: '5px' }}>AVAILABLE TO WITHDRAW</div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: T.gold }}>{Number(user?.wallet?.balance || 0).toFixed(2)} <span style={{ fontSize: '14px', opacity: 0.5 }}>ETB</span></div>
          <Wallet size={60} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.1, color: T.gold }} />
        </div>

        {/* ── Rules Alert ── */}
        <div style={{ background: 'rgba(212, 175, 55, 0.05)', border: `1px solid rgba(212, 175, 55, 0.2)`, padding: '15px', borderRadius: '16px', marginBottom: '25px', display: 'flex', gap: '12px' }}>
          <Info size={20} color={T.gold} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', lineHeight: '1.5', opacity: 0.8 }}>
            <b>Rules:</b> Min withdrawal is 200 ETB. Max is 10,000 ETB. You must have played at least 5 games and won at least once. Requests are processed by your specific agent.
          </div>
        </div>

        {/* ── Withdrawal Form ── */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
             <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', paddingLeft: '5px' }}>AMOUNT TO WITHDRAW (ETB)</label>
             <div style={{ position: 'relative' }}>
                <Banknote size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Minimum 200 ETB"
                  required
                  style={{ width: '100%', padding: '15px 15px 15px 45px', borderRadius: '16px', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: '16px', fontWeight: '900', outline: 'none' }}
                />
             </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
             <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', paddingLeft: '5px' }}>SELECT BANK</label>
             <select 
               value={bankName}
               onChange={(e) => setBankName(e.target.value)}
               style={{ width: '100%', padding: '15px', borderRadius: '16px', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: '16px', fontWeight: '900', outline: 'none' }}
             >
                <option value="Telebirr">Telebirr</option>
             </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
             <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', paddingLeft: '5px' }}>ACCOUNT NUMBER / PHONE</label>
             <div style={{ position: 'relative' }}>
                <Smartphone size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                <input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account or phone"
                  required
                  style={{ width: '100%', padding: '15px 15px 15px 45px', borderRadius: '16px', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: '16px', fontWeight: '900', outline: 'none' }}
                />
             </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
             <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', paddingLeft: '5px' }}>ACCOUNT HOLDER NAME</label>
             <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                <input 
                  type="text" 
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Full name on account"
                  required
                  style={{ width: '100%', padding: '15px 15px 15px 45px', borderRadius: '16px', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: '16px', fontWeight: '900', outline: 'none' }}
                />
             </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '12px', borderRadius: '12px', display: 'flex', gap: '10px', marginBottom: '20px', color: '#ef4444', fontSize: '13px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '18px', borderRadius: '20px', background: T.gold, border: 'none', color: T.header, fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}
          >
            {loading ? 'Processing...' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* ── Navbar ── */}
      <div style={{ position: 'fixed', bottom: 15, left: 15, right: 15, background: T.header, display: 'flex', justifyContent: 'space-around', padding: '10px 5px', borderRadius: '20px', border: `1px solid ${T.gold}`, zIndex: 1000 }}>
         {[
           { label: 'Game',    icon: <Play size={20} color={T.gold} />, active: false, path: '/' },
           { label: 'Scores',  icon: <Trophy size={20} color={T.gold} />, active: false, path: '/scores' },
           { label: 'History', icon: <History size={20} color={T.gold} />, active: false, path: '/history' },
           { label: 'Wallet',  icon: <Wallet size={20} fill={T.gold} color={T.gold} />, active: true, path: '/wallet' },
           { label: 'Profile', icon: <UserIcon size={20} color={T.gold} />, active: false, path: '/profile' },
         ].map((item) => (
           <div key={item.label} onClick={() => router.push(item.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1, opacity: item.active ? 1 : 0.5, cursor: 'pointer' }}>
             {item.icon}
             <span style={{ fontSize: '10px', fontWeight: '900', color: T.gold }}>{item.label}</span>
           </div>
         ))}
      </div>
    </div>
  );
}
