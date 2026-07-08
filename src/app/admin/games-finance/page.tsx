"use client";

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PdfExportButton } from '@/components/PdfExportButton';
import { 
  FiActivity, FiDollarSign, FiTrendingUp, FiCheckCircle, 
  FiAlertTriangle, FiList 
} from 'react-icons/fi';
import '@/app/admin.css';

type GameTab = 'bingo' | 'aviator' | 'slot' | 'keno';

export default function GamesFinancePage() {
  const [activeTab, setActiveTab] = useState<GameTab>('bingo');
  const [timeRange, setTimeRange] = useState('all');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/games-finance?game=${activeTab}&range=${timeRange}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch game finance data', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div className="admin-container" id="printable-area">
      <div className="page-header print-hide">
        <div>
          <h1 className="page-title">GAMES FINANCE</h1>
          <p className="page-subtitle">Unified financial reporting across all games</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={timeRange} 
            onChange={e => setTimeRange(e.target.value)}
            className="modern-select"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <PdfExportButton filename={`Buna_Games_Finance_${activeTab}.pdf`} title="Export PDF" />
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only-header" style={{ display: 'none', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111' }}>Buna Bingo - Game Finance Report</h1>
        <p style={{ fontSize: '14px', color: '#555' }}>Game: {activeTab.toUpperCase()} | Range: {timeRange.toUpperCase()} | Printed: {new Date().toLocaleString()}</p>
        <hr style={{ marginTop: '10px', borderColor: '#eee' }} />
      </div>

      {/* Tabs */}
      <div className="tabs-container print-hide" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['bingo', 'aviator', 'slot', 'keno'] as GameTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === tab ? 'var(--cmd-card)' : 'transparent',
              color: activeTab === tab ? '#d4af37' : '#6b7280',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderBottom: activeTab === tab ? '2px solid #d4af37' : '2px solid transparent'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>Loading...</div>
      ) : data ? (
        <>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div className="stat-card" style={{ background: 'var(--cmd-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--cmd-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--cmd-tan)', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Volume</div>
                <FiActivity color="var(--cmd-tan)" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: 'white' }}>
                {fmt(data.stats?.totalVolume)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: 'var(--cmd-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--cmd-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#f87171', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Payouts</div>
                <FiDollarSign color="#f87171" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: 'white' }}>
                {fmt(data.stats?.totalPayout)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: 'var(--cmd-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--cmd-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#4ade80', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Profit (Company)</div>
                <FiTrendingUp color="#4ade80" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: 'white' }}>
                {fmt(data.stats?.netProfit)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: 'var(--cmd-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--cmd-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#60a5fa', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Rounds / Bets</div>
                <FiList color="#60a5fa" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: 'white' }}>
                {Number(data.stats?.totalCount || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="table-container" style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <FiActivity size={18} color="#d4af37" />
               <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Activity</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280' }}>
                    <th style={{ padding: '16px 20px', fontWeight: '800' }}>Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: '800' }}>Player</th>
                    <th style={{ padding: '16px 20px', fontWeight: '800' }}>Bet / Stake</th>
                    <th style={{ padding: '16px 20px', fontWeight: '800' }}>Payout</th>
                    <th style={{ padding: '16px 20px', fontWeight: '800' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent?.map((item: any) => (
                    <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                      <td style={{ padding: '16px 20px', color: '#6b7280', fontSize: '13px' }}>
                        {new Date(item.date).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px' }}>{item.username}</td>
                      <td style={{ padding: '16px 20px' }}>{fmt(item.betAmount)} ETB</td>
                      <td style={{ padding: '16px 20px', color: item.winAmount > 0 ? '#10b981' : '#6b7280' }}>
                        {fmt(item.winAmount)} ETB
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {item.status === 'WON' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#dcfce7', color: '#166534', borderRadius: '100px', fontSize: '11px', fontWeight: '800' }}>
                            <FiCheckCircle size={12} /> WON
                          </span>
                        ) : item.status === 'LOST' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#f3f4f6', color: '#4b5563', borderRadius: '100px', fontSize: '11px', fontWeight: '800' }}>
                            LOST
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: '100px', fontSize: '11px', fontWeight: '800' }}>
                            {item.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.recent?.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                        No recent activity found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>Failed to load data.</div>
      )}
    </div>
  );
}
