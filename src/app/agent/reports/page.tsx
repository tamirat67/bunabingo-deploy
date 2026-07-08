"use client";

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PdfExportButton } from '@/components/PdfExportButton';
import { 
  FiActivity, FiDollarSign, FiUsers, FiTrendingUp 
} from 'react-icons/fi';
import '@/app/admin.css';
import '@/app/agent.css';

export default function AgentReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Reusing the agent stats endpoint with timeRange filter
      const res = await api.get(`/agent/stats?range=${timeRange}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch report data', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div className="admin-container" id="printable-area">
      <div className="page-header print-hide">
        <div>
          <h1 className="page-title">FINANCIAL REPORTS</h1>
          <p className="page-subtitle">Exportable summary of your branch's performance</p>
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
          <PdfExportButton filename={`Branch_Report_${timeRange}.pdf`} title="Export PDF" />
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only-header" style={{ display: 'none', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111' }}>Branch Performance Report</h1>
        <p style={{ fontSize: '14px', color: '#555' }}>Range: {timeRange.toUpperCase()} | Printed: {new Date().toLocaleString()}</p>
        <hr style={{ marginTop: '10px', borderColor: '#eee' }} />
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>Loading...</div>
      ) : data ? (
        <>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            
            <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Deposits</div>
                <FiDollarSign color="#10b981" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: '#111' }}>
                {fmt(data.totalDeposited)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Withdrawals</div>
                <FiDollarSign color="#ef4444" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: '#111' }}>
                {fmt(data.totalWithdrawn)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Commissions Earned</div>
                <FiTrendingUp color="#d4af37" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: '#111' }}>
                {fmt(data.agentEarned || 0)} <span style={{ fontSize: '12px', color: '#888' }}>ETB</span>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Players</div>
                <FiUsers color="#3b82f6" />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', marginTop: '12px', color: '#111' }}>
                {Number(data.activePlayers || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="table-container" style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <FiActivity size={18} color="#d4af37" />
               <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '1px' }}>Summary by Category</h3>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                This report summarizes the financial activity generated by players registered under your branch. 
                Use the Export PDF button to save this record for accounting purposes. 
                If you have pending commissions, they will be paid out to your balance according to the standard settlement schedule.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>Failed to load data.</div>
      )}
    </div>
  );
}
