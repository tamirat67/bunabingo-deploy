'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiDollarSign, FiActivity, FiTrendingUp, FiCreditCard } from 'react-icons/fi';

interface AviatorReport {
  masterAgent: {
    id: string;
    name: string;
    username: string;
    aviatorBalance: number;
  };
  stats: {
    totalVolume: number;
    totalPayout: number;
    netProfit: number;
    totalBetsCount: number;
  };
  recentBets: Array<{
    id: string;
    date: string;
    username: string;
    betAmount: number;
    cashoutMultiplier: number | null;
    crashMultiplier: number | null;
    winAmount: number | null;
    status: string;
    profit: number;
  }>;
}

export default function AviatorFinancePage() {
  const router = useRouter();
  const [data, setData] = useState<AviatorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';
      const res = await fetch(`${API}/api/admin/aviator-finance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to load data');
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--cmd-gold)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--cmd-gold)' }}></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '20px', color: '#ff4444', background: 'rgba(255,0,0,0.1)', borderRadius: '12px' }}>
        <strong>Error:</strong> {error || 'Failed to load report'}
      </div>
    );
  }

  const { masterAgent, stats, recentBets } = data;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiActivity color="var(--cmd-gold)" /> Aviator Finance Report
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: '5px 0 0 0', fontSize: '14px' }}>
            Global pool metrics and master agent wallet balance
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'linear-gradient(145deg, #1a1a2e, #111122)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,215,0,0.2)', boxShadow: '0 8px 32px rgba(255,215,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <FiDollarSign size={20} color="var(--cmd-gold)" />
            <span style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Master Wallet (@Luel1616)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--cmd-gold)' }}>
            {masterAgent.aviatorBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px' }}>ETB</span>
          </div>
        </div>

        <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <FiCreditCard size={20} />
            <span style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Total Bet Volume</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#fff' }}>
            {stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>ETB</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Across {stats.totalBetsCount} total bets</div>
        </div>

        <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <FiTrendingUp size={20} color="#2ecc71" />
            <span style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Total Payouts</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#fff' }}>
            {stats.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>ETB</span>
          </div>
        </div>

        <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <FiActivity size={20} color={stats.netProfit >= 0 ? "#2ecc71" : "#e74c3c"} />
            <span style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Net House Profit</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c' }}>
            {stats.netProfit > 0 ? '+' : ''}{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>ETB</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div style={{ background: '#1a1a2e', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Recent Game Transactions</h2>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Last 50 bets</span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Player</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Bet Amount</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Crash (x)</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Cashout (x)</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>Payout</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'right' }}>House Profit</th>
              </tr>
            </thead>
            <tbody>
              {recentBets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                    No Aviator transactions found.
                  </td>
                </tr>
              ) : recentBets.map((bet) => (
                <tr key={bet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '16px 20px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                    {new Date(bet.date).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '500' }}>
                    {bet.username}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#f1c40f', fontWeight: '600' }}>
                    {bet.betAmount.toFixed(2)}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#e74c3c', fontWeight: '600' }}>
                    {bet.crashMultiplier ? `${bet.crashMultiplier.toFixed(2)}x` : '-'}
                  </td>
                  <td style={{ padding: '16px 20px', color: bet.status === 'WON' ? '#2ecc71' : 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
                    {bet.cashoutMultiplier ? `${bet.cashoutMultiplier.toFixed(2)}x` : '-'}
                  </td>
                  <td style={{ padding: '16px 20px', color: bet.status === 'WON' ? '#2ecc71' : 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
                    {bet.winAmount ? bet.winAmount.toFixed(2) : '-'}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '700', color: bet.profit > 0 ? '#2ecc71' : (bet.profit < 0 ? '#e74c3c' : 'rgba(255,255,255,0.4)') }}>
                    {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
