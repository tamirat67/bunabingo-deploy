"use client";

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  FiTrendingUp, FiDollarSign, FiAlertTriangle, FiUsers,
  FiShield, FiBarChart2, FiActivity, FiInfo
} from 'react-icons/fi';

// ─── SVG Trend Chart ──────────────────────────────────────────────────────────
function TrendChart({
  trend,
}: {
  trend: { label: string; realSales: number; botSales: number; companyRevenue: number }[];
}) {
  const W = 600, H = 220, PADDING = 48;
  const innerW = W - PADDING * 2;
  const innerH = H - PADDING * 1.5;

  const allVals = trend.flatMap(d => [d.realSales, d.botSales, d.companyRevenue]);
  const maxVal  = Math.max(...allVals, 1);

  const xStep = innerW / Math.max(trend.length - 1, 1);

  const pts = (key: 'realSales' | 'botSales' | 'companyRevenue') =>
    trend
      .map((d, i) => {
        const x = PADDING + i * xStep;
        const y = H - PADDING * 0.75 - (d[key] / maxVal) * innerH;
        return `${x},${y}`;
      })
      .join(' ');

  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const y = H - PADDING * 0.75 - frac * innerH;
        return (
          <g key={i}>
            <line x1={PADDING} y1={y} x2={W - PADDING} y2={y} stroke="#f0ede8" strokeWidth="1" />
            <text x={PADDING - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#b0a89e">
              {fmt(maxVal * frac)}
            </text>
          </g>
        );
      })}

      {/* Lines */}
      <polyline points={pts('botSales')}    fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts('realSales')}   fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts('companyRevenue')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + X labels */}
      {trend.map((d, i) => {
        const x = PADDING + i * xStep;
        const yReal = H - PADDING * 0.75 - (d.realSales / maxVal) * innerH;
        const yBot  = H - PADDING * 0.75 - (d.botSales  / maxVal) * innerH;
        const yComp = H - PADDING * 0.75 - (d.companyRevenue / maxVal) * innerH;
        return (
          <g key={i}>
            <circle cx={x} cy={yReal} r="3.5" fill="#22c55e" />
            <circle cx={x} cy={yBot}  r="3.5" fill="#f97316" />
            <circle cx={x} cy={yComp} r="3"   fill="#3b82f6" />
            <text x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="#b0a89e">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, accent, synthetic,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  synthetic?: boolean;
}) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      border: `1px solid ${accent}30`,
      padding: '22px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {synthetic && (
        <span style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          fontSize: '9px',
          fontWeight: '900',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          background: '#fff7ed',
          color: '#ea580c',
          border: '1px solid #fed7aa',
          borderRadius: '999px',
          padding: '2px 8px',
        }}>⚠ SYNTHETIC</span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '12px',
          background: `${accent}15`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '900', color: accent, fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#8c857b', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const [data, setData] = useState<any>(null);
  const [overallStats, setOverallStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [botRes, statsRes] = await Promise.all([
          api.get('/admin/bot-analytics'),
          api.get('/admin/analytics'),
        ]);
        setData(botRes.data.data);
        setOverallStats(statsRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', padding: '8px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ height: '140px', background: '#f5f3ef', borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  const {
    totalBotSales, totalRealSales, totalAllSales,
    botParticipationRate, realCompanyRevenue, realAgentRevenue, botCompanyRevenue,
    botPlayerCount, realPlayerCount, totalGamesFinished,
    botWinPayouts, botWinPayoutAmount, botWinCount,
    trend, roomBreakdown,
  } = data;

  const totalDeposited  = Number(overallStats?.totalDeposited || 0);
  const totalWithdrawn  = Number(overallStats?.totalWithdrawn || 0);
  const netCashPosition = totalDeposited - totalWithdrawn;
  const realPct = totalAllSales > 0 ? (totalRealSales / totalAllSales) * 100 : 0;
  const botPct  = totalAllSales > 0 ? (totalBotSales  / totalAllSales) * 100 : 0;

  // Dynamic rates from admin analytics (set in Settings page)
  const companyRevRate = overallStats?.companyRevenueRate ?? 20;   // e.g. 20
  const agentRevRate   = overallStats?.agentRevenueRate   ?? 10;   // e.g. 10
  const totalHouseEdge = overallStats?.companyCommissionRate ?? 30; // e.g. 30
  const winnerPct      = 100 - totalHouseEdge;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: '8px', fontFamily: 'Inter, sans-serif' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>
          📊 Revenue Analytics
        </h1>
        <p style={{ color: '#8c857b', marginTop: '4px', fontSize: '14px' }}>
          Real company revenue vs house bot synthetic revenue — all-time breakdown
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          icon={<FiDollarSign size={18} />}
          label="Real Company Revenue"
          value={`${fmt(realCompanyRevenue)} ETB`}
          sub={`✅ ${companyRevRate}% of real player sales — actual profit`}
          accent="#22c55e"
        />
        <KpiCard
          icon={<FiTrendingUp size={18} />}
          label="Real Gross Sales"
          value={`${fmt(totalRealSales)} ETB`}
          sub={`${realPct.toFixed(1)}% of total volume`}
          accent="#3b82f6"
        />
        <KpiCard
          icon={<FiUsers size={18} />}
          label="Agent Revenue"
          value={`${fmt(realAgentRevenue)} ETB`}
          sub={`✅ ${agentRevRate}% of real player sales — actual agent share`}
          accent="#8b5cf6"
        />
        <KpiCard
          icon={<FiAlertTriangle size={18} />}
          label="Bot Gross Sales"
          value={`${fmt(totalBotSales)} ETB`}
          sub={`⚠ Synthetic ETB — ${botPct.toFixed(1)}% of volume`}
          accent="#f97316"
          synthetic
        />
        <KpiCard
          icon={<FiShield size={18} />}
          label="House Advantage (Bot Wins Kept)"
          value={`${fmt(botWinPayoutAmount)} ETB`}
          sub={`Prize stayed in system reserve across ${botWinCount} bot wins`}
          accent="#d97706"
          synthetic
        />
        <KpiCard
          icon={<FiActivity size={18} />}
          label="Net Cash Position"
          value={`${fmt(netCashPosition)} ETB`}
          sub={`Deposits ${fmt(totalDeposited)} − Withdrawals ${fmt(totalWithdrawn)}`}
          accent={netCashPosition >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* ── 7-Day Trend Chart ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        padding: '24px 28px',
        marginBottom: '28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '900', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px' }}>
              7-Day Revenue Trend
            </div>
            <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '2px' }}>
              Real sales vs bot sales vs company revenue (last 7 days)
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { color: '#22c55e', label: 'Real Sales' },
              { color: '#f97316', label: 'Bot Sales (Synthetic)' },
              { color: '#3b82f6', label: `Company Revenue (${companyRevRate}%)` },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '3px', background: color, borderRadius: '2px' }} />
                <span style={{ fontSize: '11px', color: '#8c857b', fontWeight: '600' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <TrendChart trend={trend} />
      </div>

      {/* ── Real vs Bot Summary Panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        {/* Real Revenue Stream */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          borderRadius: '20px',
          border: '1px solid #86efac',
          padding: '24px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: '#059669', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
            ✅ REAL MONEY STREAM
          </div>
          <div style={{ fontSize: '13px', color: '#065f46', lineHeight: '1.8' }}>
            <div>👥 Real Players: <strong>{realPlayerCount.toLocaleString()}</strong></div>
            <div>🎟 Real Ticket Sales: <strong>{fmt(totalRealSales)} ETB</strong></div>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px' }}>
              <div>🏦 Company ({companyRevRate}%): <strong style={{ color: '#059669' }}>{fmt(realCompanyRevenue)} ETB</strong></div>
              <div>🤝 Agents ({agentRevRate}%): <strong style={{ color: '#059669' }}>{fmt(realAgentRevenue)} ETB</strong></div>
              <div>🏆 Prize Pool ({winnerPct}%): <strong style={{ color: '#059669' }}>{fmt(totalRealSales * (winnerPct / 100))} ETB</strong></div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700', marginBottom: '4px' }}>
              Share of Total Volume: {realPct.toFixed(1)}%
            </div>
            <div style={{ height: '6px', background: '#bbf7d0', borderRadius: '999px' }}>
              <div style={{ width: `${realPct}%`, height: '100%', background: '#22c55e', borderRadius: '999px' }} />
            </div>
          </div>
        </div>

        {/* Bot Revenue Stream */}
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
          borderRadius: '20px',
          border: '1px solid #fdba74',
          padding: '24px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: '#ea580c', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
            ⚠ SYNTHETIC / HOUSE BOT STREAM
          </div>
          <div style={{ fontSize: '13px', color: '#9a3412', lineHeight: '1.8' }}>
            <div>🤖 Bot Players: <strong>{botPlayerCount.toLocaleString()}</strong></div>
            <div>🎟 Bot Ticket Value: <strong>{fmt(totalBotSales)} ETB</strong> (synthetic)</div>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px' }}>
              <div>🏠 Bot Wins (count): <strong style={{ color: '#ea580c' }}>{botWinCount?.toLocaleString() ?? botWinPayouts.toLocaleString()}</strong></div>
              <div>💰 House Advantage: <strong style={{ color: '#d97706' }}>{fmt(botWinPayoutAmount)} ETB</strong></div>
              <div style={{ fontSize: '10px', color: '#c2410c', marginTop: '4px', fontStyle: 'italic' }}>
                ↳ When bot wins, prize stays in system reserve (engine skips bot wallet credit)
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: '700', marginBottom: '4px' }}>
              Share of Total Volume: {botPct.toFixed(1)}%
            </div>
            <div style={{ height: '6px', background: '#fed7aa', borderRadius: '999px' }}>
              <div style={{ width: `${botPct}%`, height: '100%', background: '#f97316', borderRadius: '999px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Room-by-Room Breakdown Table ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        padding: '24px 28px',
        marginBottom: '28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '900', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          📦 Room-by-Room Revenue Split
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0ede8' }}>
                {['Room', 'Price', 'Real Tickets', 'Real Sales', 'Bot Tickets', 'Bot Sales (Synthetic)', 'Real Revenue (20%)'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Room' || h === 'Price' ? 'left' : 'right', padding: '10px 14px', fontSize: '10px', fontWeight: '900', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomBreakdown.map((r: any) => {
                const totalTickets = r.realTickets + r.botTickets;
                const realRatio = totalTickets > 0 ? (r.realTickets / totalTickets) * 100 : 0;
                return (
                  <tr key={r.roomType} style={{ borderBottom: '1px solid #f5f3ef' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '700', color: '#3d2b1f' }}>
                      {r.roomType.charAt(0) + r.roomType.slice(1).toLowerCase()}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#8c857b' }}>{r.ticketPrice} ETB</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669', fontWeight: '700' }}>
                      {r.realTickets.toLocaleString()}
                      <div style={{ fontSize: '10px', color: '#86efac' }}>{realRatio.toFixed(0)}% of room</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669', fontWeight: '700' }}>
                      {fmt(r.realSales)} ETB
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ea580c', fontWeight: '700' }}>
                      {r.botTickets.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ea580c', fontWeight: '600', fontSize: '12px' }}>
                      {fmt(r.botSales)} ETB
                      <div style={{ fontSize: '9px', color: '#f97316' }}>synthetic</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#3b82f6', fontWeight: '800' }}>
                      {fmt(r.realRevenue)} ETB
                    </td>
                  </tr>
                );
              })}
              {/* Totals Row */}
              <tr style={{ background: '#faf8f5', fontWeight: '900' }}>
                <td colSpan={2} style={{ padding: '12px 14px', color: '#3d2b1f', fontSize: '12px' }}>TOTAL</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669' }}>
                  {roomBreakdown.reduce((s: number, r: any) => s + r.realTickets, 0).toLocaleString()}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669' }}>
                  {fmt(roomBreakdown.reduce((s: number, r: any) => s + r.realSales, 0))} ETB
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ea580c' }}>
                  {roomBreakdown.reduce((s: number, r: any) => s + r.botTickets, 0).toLocaleString()}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ea580c' }}>
                  {fmt(roomBreakdown.reduce((s: number, r: any) => s + r.botSales, 0))} ETB
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#3b82f6' }}>
                  {fmt(roomBreakdown.reduce((s: number, r: any) => s + r.realRevenue, 0))} ETB
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 7-Day Daily Trend Table ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        padding: '24px 28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        marginBottom: '28px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '900', color: '#3d2b1f', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          📅 7-Day Daily Breakdown
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0ede8' }}>
                {['Day', 'Real Sales', 'Bot Sales (Synthetic)', `Company Rev (${companyRevRate}%)`, `Agent Rev (${agentRevRate}%)`].map(h => (
                  <th key={h} style={{ textAlign: h === 'Day' ? 'left' : 'right', padding: '10px 14px', fontSize: '10px', fontWeight: '900', color: '#8c857b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((d: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f3ef', background: i === trend.length - 1 ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: '12px 14px', fontWeight: i === trend.length - 1 ? '900' : '600', color: '#3d2b1f' }}>
                    {d.label} {i === trend.length - 1 ? '(Today)' : ''}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669', fontWeight: '700' }}>
                    {fmt(d.realSales)} ETB
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ea580c', fontWeight: '600', fontSize: '12px' }}>
                    {fmt(d.botSales)} ETB
                    {d.botSales > 0 && <span style={{ fontSize: '9px', color: '#f97316', display: 'block' }}>synthetic</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#3b82f6', fontWeight: '800' }}>
                    {fmt(d.companyRevenue)} ETB
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#8b5cf6', fontWeight: '700' }}>
                    {fmt(d.agentRevenue)} ETB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Accounting Info Box ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '20px',
        padding: '24px 28px',
        color: '#fff',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}>
        <FiInfo size={24} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ fontSize: '13px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Understanding Bot Revenue Accounting
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', lineHeight: '2', fontSize: '13px', color: '#cbd5e1' }}>
            <li>House bots buy tickets using <strong style={{ color: '#fbbf24' }}>synthetic credits</strong> (not real deposited ETB)</li>
            <li>When a bot wins, the payout is credited to the bot's wallet — but bots <strong style={{ color: '#4ade80' }}>cannot withdraw</strong>, so the money stays in the system</li>
            <li><strong style={{ color: '#22c55e' }}>Real Company Revenue</strong> = {companyRevRate}% × real player ticket sales only</li>
            <li><strong style={{ color: '#f97316' }}>Bot "Revenue"</strong> is labeled SYNTHETIC — it is NOT actual profit and should NOT be counted as company income</li>
            <li>Net Cash Position = Total Deposits − Total Approved Withdrawals (real cash flow)</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
