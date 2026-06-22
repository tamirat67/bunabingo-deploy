"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FiArrowLeft, FiUser, FiCalendar, FiDollarSign, FiTrendingUp, FiTrendingDown,
  FiActivity, FiUsers, FiCheckCircle, FiAlertTriangle, FiInfo, FiArrowDownLeft,
  FiArrowUpRight, FiClock, FiAward, FiBarChart2, FiPercent, FiDownload
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import BunaModal from '@/components/BunaModal';

export default function AgentReportPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'players' | 'wallet'>('overview');
  const [timeRange, setTimeRange] = useState('current_period');
  const [settleAmount, setSettleAmount] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/agents/${agentId}/report?range=${timeRange}`);
      setReport(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load agent report');
    } finally {
      setLoading(false);
    }
  }, [agentId, timeRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleSettleDebt = () => {
    const amount = Number(settleAmount);
    const outstanding = (report?.stats?.netCashFlow || 0) - (report?.stats?.agentEarned || 0);
    if (!amount || amount <= 0 || amount > outstanding) {
      return alert('Please enter a valid amount up to the expected cash.');
    }
    setShowSettleModal(true);
  };

  const executeSettleDebt = async () => {
    const amount = Number(settleAmount);
    setIsSettling(true);
    setShowSettleModal(false);
    try {
      await api.post(`/admin/agents/${agentId}/collect-cash`, { 
        amount: amount, 
        settleDebtAmount: amount 
      });
      setSettleAmount('');
      fetchReport();
      alert('Cash collected and reporting period reset successfully!');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to settle debt.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleUndoCollect = () => {
    setShowUndoModal(true);
  };

  const executeUndoCollect = async () => {
    setIsUndoing(true);
    setShowUndoModal(false);
    try {
      await api.post(`/admin/agents/${agentId}/undo-collect`);
      fetchReport();
      alert('Successfully undid the last collection! The dashboard has been restored.');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to undo collection.');
    } finally {
      setIsUndoing(false);
    }
  };

  const generatePDF = async () => {
    if (!report) return;
    const { agent, stats, recentDeposits, recentTransactions } = report;

    const doc = new jsPDF();
    
    // Attempt to load logo image
    let logoImg: HTMLImageElement | string | null = null;
    try {
      logoImg = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.src = '/logo.png';
        img.onload = () => {
          // Crop image to circle using canvas
          const canvas = document.createElement('canvas');
          const size = Math.min(img.width, img.height);
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            // Center the image if it's not perfectly square
            const dx = (size - img.width) / 2;
            const dy = (size - img.height) / 2;
            ctx.drawImage(img, dx, dy, img.width, img.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(img); // Fallback to raw image if canvas fails
          }
        };
        img.onerror = (e) => reject(e);
      });
    } catch (err) {
      console.warn("Could not load logo image for PDF", err);
    }

    // ── Load Amharic font ────────────────────────────────────
    let hasAmharic = false;
    try {
      const fontRes = await fetch('/fonts/NotoSansEthiopic.ttf');
      const fontBuf = await fontRes.arrayBuffer();
      const uint8 = new Uint8Array(fontBuf);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const fontB64 = btoa(binary);
      doc.addFileToVFS('NotoSansEthiopic.ttf', fontB64);
      doc.addFont('NotoSansEthiopic.ttf', 'NotoSansEthiopic', 'normal');
      hasAmharic = true;
    } catch (e) {
      console.warn('Could not load Amharic font', e);
    }

    const setAmharic = () => { if (hasAmharic) doc.setFont('NotoSansEthiopic', 'normal'); };
    const setLatin   = () => doc.setFont('helvetica', 'normal');

    const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (r: number) => (r * 100).toFixed(1) + '%';

    const pageWidth  = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const totalExpected = Math.max(0, stats.netCashFlow - stats.agentEarned);

    // ── DARK HEADER BAR ─────────────────────────────────────
    doc.setFillColor(61, 43, 31);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Gold accent stripe
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Logo
    if (logoImg) {
      doc.addImage(logoImg as string, 'PNG', 8, 5, 18, 18);
    }

    // Brand
    setLatin();
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55);
    doc.text('BUNA BINGO', 30, 13);
    doc.setFontSize(8);
    doc.setTextColor(180, 160, 120);
    doc.text('BUNA TECH HUB', 30, 20);

    // Report title right side
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('AGENT CASH COLLECTION REPORT', pageWidth - 10, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(180, 160, 120);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 10, 20, { align: 'right' });

    // ── AGENT INFO CARD ──────────────────────────────────────
    doc.setFillColor(253, 251, 247);
    doc.setDrawColor(220, 200, 160);
    doc.setLineWidth(0.4);
    doc.roundedRect(10, 33, pageWidth - 20, 20, 3, 3, 'FD');

    setLatin();
    doc.setFontSize(11);
    doc.setTextColor(61, 43, 31);
    doc.text(`Agent: ${agent.firstName}`, 14, 41);
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    doc.text(`@${agent.telegramUsername || 'N/A'}  ·  ID: ${agent.telegramId}`, 14, 48);

    const rangeLabel = timeRange === 'all' ? 'All Time' : timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'Last 7 Days' : timeRange === 'current_period' ? 'Current Period' : 'Last 30 Days';
    doc.text(`Period: ${rangeLabel}  ·  Players: ${stats.totalPlayers}`, pageWidth - 10, 41, { align: 'right' });
    doc.text(`Real Cash: Bonus ETB strictly excluded`, pageWidth - 10, 48, { align: 'right' });


    // ── CASH FLOW WATERFALL TABLE (Bilingual) ─────────────────
    const tableBody = [
      [
        { content: 'REAL CASH DEPOSITED\nጥሬ ገንዘብ ገቢ', styles: { textColor: [21, 128, 61] as [number,number,number] } },
        { content: `+ ${fmt(stats.totalDeposited)} ETB`, styles: { textColor: [21, 128, 61] as [number,number,number] } },
        { content: 'Physical cash paid by players — bonus excluded\nተጫዋቾች የከፈሉ ጥሬ ብር — ቦነስ አልተካተተም' },
      ],
      [
        { content: 'REAL CASH WITHDRAWN\nጥሬ ገንዘብ ወጪ', styles: { textColor: [185, 28, 28] as [number,number,number] } },
        { content: `- ${fmt(stats.totalWithdrawn)} ETB`, styles: { textColor: [185, 28, 28] as [number,number,number] } },
        { content: 'Cash paid out to winning players\nለአሸናፊ ተጫዋቾች የተከፈለ' },
      ],
      [
        { content: 'NET CASH FLOW\nየተጣራ ጥሬ ገንዘብ', styles: { textColor: [14, 100, 57] as [number,number,number], fillColor: [240, 253, 244] as [number,number,number] } },
        { content: `${fmt(stats.netCashFlow)} ETB`, styles: { textColor: [14, 100, 57] as [number,number,number], fillColor: [240, 253, 244] as [number,number,number] } },
        { content: 'Deposits − Withdrawals (real physical cash held)\nገቢ − ወጪ (ወኪሉ ዘንድ ያለ ጥሬ ብር)', styles: { fillColor: [240, 253, 244] as [number,number,number] } },
      ],
      [
        { content: 'AGENT COMMISSION (' + fmtPct(stats.agentRate) + ')\nየወኪል ኮሚሽን', styles: { textColor: [180, 83, 9] as [number,number,number] } },
        { content: `- ${fmt(stats.agentEarned)} ETB`, styles: { textColor: [180, 83, 9] as [number,number,number] } },
        { content: "Agent's earned share — deducted before collection\nሊሰበሰብ ከሚገባው ቀርቶ የሚወሰድ" },
      ]
    ];

    autoTable(doc, {
      startY: 60,
      head: [['Metric / መለኪያ', 'Amount / መጠን', 'Notes / ማብራሪያ']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [61, 43, 31], textColor: [255, 255, 255],
        fontSize: 9, fontStyle: 'normal', halign: 'left',
        font: hasAmharic ? 'NotoSansEthiopic' : 'helvetica',
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      },
      bodyStyles: {
        fontSize: hasAmharic ? 9 : 9.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
        textColor: [60, 60, 60], font: hasAmharic ? 'NotoSansEthiopic' : 'helvetica',
      },
      alternateRowStyles: { fillColor: [252, 250, 248] },
      columnStyles: {
        0: { cellWidth: 64 },
        1: { cellWidth: 42, halign: 'right' },
        2: { textColor: [120, 113, 108], fontSize: 8 },
      },
      margin: { top: 32, bottom: 32, left: 10, right: 10 },
    });

    // ── BIG EXPECTED CASH TO COLLECT BOX ────────────────────
    const tableEndY = (doc as any).lastAutoTable?.finalY || 180;
    const boxY = tableEndY + 8;

    // Outer shadow/border effect
    doc.setFillColor(180, 140, 20);
    doc.roundedRect(10, boxY + 1.5, pageWidth - 20, 28, 4, 4, 'F');

    // Main gold box
    doc.setFillColor(212, 175, 55);
    doc.setDrawColor(150, 110, 10);
    doc.setLineWidth(1);
    doc.roundedRect(10, boxY, pageWidth - 20, 28, 4, 4, 'FD');

    // Label
    setLatin();
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 50, 10);
    doc.text('TOTAL CASH TO COLLECT FROM THIS AGENT', pageWidth / 2, boxY + 9, { align: 'center' });

    // Amharic label
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(8);
      doc.setTextColor(100, 65, 15);
      doc.text(`ከ ${agent.firstName} ሊሰበሰብ የሚገባ ጠቅላላ ናቁድ`, pageWidth / 2, boxY + 16, { align: 'center' });
      setLatin();
    }

    // Big amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(61, 43, 31);
    doc.text(`${fmt(totalExpected)} ETB`, pageWidth / 2, boxY + 25, { align: 'center' });

    // ── SIGNATURE / SUBMIT SECTION (Bilingual) ────────────────
    const sigY = boxY + 40;

    // Section title — bilingual
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(61, 43, 31);
    doc.text('OFFICIAL SUBMISSION', 10, sigY);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(8);
      doc.setTextColor(100, 70, 20);
      doc.text('ይፋዊ ቀረባ / ፊርማ', 10, sigY + 6);
      setLatin();
    }

    // Gold divider under title
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.6);
    doc.line(10, sigY + 9, pageWidth - 10, sigY + 9);

    // ── ROW 1 columns ─────────────────────────────────────────
    const col1x = 10;
    const col2x = pageWidth / 2 - 18;
    const col3x = pageWidth - 58;
    const lineY  = sigY + 30;

    doc.setDrawColor(100, 80, 40);
    doc.setLineWidth(0.4);

    // Col 1 line
    doc.line(col1x, lineY, col1x + 68, lineY);
    // Col 2 line
    doc.line(col2x, lineY, col2x + 72, lineY);
    // Col 3 line
    doc.line(col3x, lineY, col3x + 50, lineY);

    // Col 1 labels — SUBMIT TO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 50, 10);
    doc.text('SUBMIT TO', col1x, lineY + 4);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(7);
      doc.setTextColor(120, 90, 30);
      doc.text('የሚቀርብለት', col1x, lineY + 10);
      setLatin();
    }

    // Col 2 labels — RECEIVED BY (SIGNATURE)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 50, 10);
    doc.text('RECEIVED BY (SIGNATURE)', col2x, lineY + 4);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(7);
      doc.setTextColor(120, 90, 30);
      doc.text('የተቀበለ (ፊርማ)', col2x, lineY + 10);
      setLatin();
    }

    // Col 3 labels — DATE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 50, 10);
    doc.text('DATE', col3x, lineY + 4);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(7);
      doc.setTextColor(120, 90, 30);
      doc.text('ቀን', col3x, lineY + 10);
      setLatin();
    }

    // ── ROW 2 columns ─────────────────────────────────────────
    const sig2Y  = sigY + 56;
    const line2Y = sig2Y + 18;

    doc.setDrawColor(100, 80, 40);
    doc.setLineWidth(0.4);
    doc.line(col1x, line2Y, col1x + 68, line2Y);
    doc.line(col2x, line2Y, col2x + 72, line2Y);

    // Col 1 — AGENT SIGNATURE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 50, 10);
    doc.text('AGENT SIGNATURE', col1x, line2Y + 4);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(7);
      doc.setTextColor(120, 90, 30);
      doc.text('የወኪል ፊርማ', col1x, line2Y + 10);
      setLatin();
    }

    // Col 2 — VERIFIED BY
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 50, 10);
    doc.text('VERIFIED BY', col2x, line2Y + 4);
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(7);
      doc.setTextColor(120, 90, 30);
      doc.text('ያረጋገጠ', col2x, line2Y + 10);
      setLatin();
    }

    // Stamp / seal box (col 3 row 2)
    doc.setDrawColor(180, 140, 20);
    doc.setLineWidth(0.6);
    doc.rect(col3x, sig2Y + 2, 50, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(160, 140, 100);
    doc.text('OFFICIAL STAMP', col3x + 25, sig2Y + 11, { align: 'center' });
    if (hasAmharic) {
      setAmharic();
      doc.setFontSize(6.5);
      doc.setTextColor(160, 140, 100);
      doc.text('ይፋዊ ማህተም', col3x + 25, sig2Y + 18, { align: 'center' });
      setLatin();
    }

    // ── FOOTER ON ALL PAGES ─────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.4);
      doc.line(10, pageHeight - 18, pageWidth - 10, pageHeight - 18);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 133, 123);
      doc.text(`BUNA TECH | bunatech.net | @Buna_BingoBot`, 10, pageHeight - 11);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - 10, pageHeight - 11, { align: 'right' });
    }



    // Sanitize filename to prevent browser from dropping the .pdf extension
    // if the agent name contains emojis or Amharic characters.
    const safeName = (agent.firstName || 'Agent').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Agent_Report_${safeName}_${timeRange}.pdf`;
    
    doc.save(fileName);
  };

  if (loading) {
    return (
      <div className="admin-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '44px', height: '44px', border: '4px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ marginTop: '16px', fontWeight: '700', color: '#3d2b1f' }}>Generating agent profit report…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#78716c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
          <FiArrowLeft /> Back
        </button>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { agent, preDepositStatus, preDepositWallet, stats, players, topPlayers, recentTransactions, recentDeposits, rechargeHistory, commissionDebits, monthlyTrend, allTimeCollected, currentPeriodStart, allSettlements } = report;

  const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => Number(n || 0).toLocaleString();
  const fmtPct = (r: number) => (r * 100).toFixed(1) + '%';

  const stateColor = preDepositStatus.state === 'RED' ? '#ef4444' : preDepositStatus.state === 'YELLOW' ? '#f59e0b' : '#10b981';
  const stateBg   = preDepositStatus.state === 'RED' ? '#fef2f2' : preDepositStatus.state === 'YELLOW' ? '#fefce8' : '#f0fdf4';
  const stateBorder = preDepositStatus.state === 'RED' ? '#fecaca' : preDepositStatus.state === 'YELLOW' ? '#fef08a' : '#bbf7d0';

  const maxTrend = Math.max(...(monthlyTrend || []).map((m: any) => Math.max(m.deposits, m.ticketSales)), 1);

  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'players', label: '👥 Players' },
    { key: 'wallet', label: '💰 Wallet & Commission' },
  ] as const;

  return (
    <div className="admin-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#78716c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>
          <FiArrowLeft /> Back to Agents
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          {/* Agent Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="user-avatar" style={{ width: '56px', height: '56px', fontSize: '22px' }}>
              {agent.firstName?.[0] || 'A'}
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>{agent.firstName}</h1>
              <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>
                {agent.telegramUsername ? `@${agent.telegramUsername}` : 'No username'} · ID {agent.telegramId}
                {agent.referralCode && <span style={{ marginLeft: '8px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}>CODE: {agent.referralCode}</span>}
              </p>
              <p style={{ color: '#a8a29e', margin: '2px 0 0', fontSize: '12px' }}>
                Member since {new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Controls Right Side */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Time Filter */}
            <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{
                    appearance: 'none', background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: '16px', padding: '16px 36px 16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    cursor: 'pointer', fontWeight: '800', color: '#3d2b1f', fontSize: '14px', outline: 'none', height: '100%'
                  }}
                >
                  <option value="current_period">Current Period (Since Last Collection)</option>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days (Weekly)</option>
                  <option value="month">Last 30 Days (Monthly)</option>
                </select>
                <FiCalendar size={16} style={{ color: '#8c857b', position: 'absolute', right: '14px', top: '18px', pointerEvents: 'none' }} />
              </div>

              <button
                onClick={generatePDF}
                style={{
                  background: '#d4af37',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '0 20px',
                  fontWeight: '800',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(212,175,55,0.2)'
                }}
              >
                <FiDownload size={18} /> Export PDF
              </button>

              <button
                onClick={handleUndoCollect}
                disabled={isUndoing}
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #fecaca',
                  borderRadius: '16px',
                  padding: '0 16px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isUndoing ? 0.6 : 1,
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                title="Undo the last mistaken cash collection"
              >
                <FiArrowLeft size={16} /> Undo Collection
              </button>
            </div>

            {/* Pre-deposit status badge */}
            <div style={{ background: stateBg, border: `1px solid ${stateBorder}`, padding: '16px 20px', borderRadius: '16px', textAlign: 'right', minWidth: '200px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: stateColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Pre-Deposit Liquidity</div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: stateColor }}>{fmt(preDepositWallet?.balance)} <span style={{ fontSize: '13px' }}>ETB</span></div>
              <div style={{ fontSize: '11px', color: stateColor, marginTop: '4px', fontWeight: '700' }}>
                {preDepositStatus.state === 'RED' ? '🔴 CRITICAL — Refill Now' : preDepositStatus.state === 'YELLOW' ? '🟡 LOW — Running Low' : '🟢 HEALTHY'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO: Agent Profit Summary ──────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #3d2b1f 60%, #5c3d2e 100%)',
        borderRadius: '20px', padding: '28px 32px', marginBottom: '28px',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'rgba(212,175,55,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '80px', width: '160px', height: '160px', background: 'rgba(212,175,55,0.05)', borderRadius: '50%' }} />

        <div style={{ fontSize: '12px', fontWeight: '800', color: '#d4af37', letterSpacing: '2px', marginBottom: '6px', textTransform: 'uppercase' }}>
          💰 Branch Profit Breakdown — {timeRange === 'all' ? 'All Time' : timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '12px' }}>
          Agent earns <strong style={{ color: '#d4af37' }}>20%</strong> of Net Cash Flow (Deposits − Withdrawals) · Company keeps the remaining <strong style={{ color: '#fbbf24' }}>80%</strong>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 12px', borderRadius: '8px', marginBottom: '28px' }}>
          <FiCheckCircle size={14} style={{ color: '#4ade80' }} />
          <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '700' }}>Real Cash Only — Bonus ETB is strictly excluded.</span>
        </div>

        {/* Massive Expected Profit Sum */}
        <div style={{ marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '28px', wordBreak: 'break-word' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
            TOTAL EXPECTED CASH FROM {agent.firstName?.toUpperCase()}
          </div>
          <div style={{ fontSize: 'clamp(32px, 8vw, 46px)', fontWeight: '900', color: '#fbbf24', lineHeight: 1.1, marginBottom: '10px' }}>
            {fmt(stats.netCashFlow - stats.agentEarned)} <span style={{ fontSize: 'clamp(16px, 4vw, 20px)', color: 'rgba(255,255,255,0.5)' }}>ETB</span>
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span><strong style={{ color: 'white' }}>{fmt(stats.netCashFlow)}</strong> ETB (Net Cash Flow)</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>−</span>
            <span><strong style={{ color: 'white' }}>{fmt(stats.agentEarned)}</strong> ETB (Agent Earnings)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {/* Agent Earned */}
          <div style={{ background: 'rgba(212,175,55,0.15)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(212,175,55,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>AGENT EARNED (20%)</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#d4af37' }}>{fmt(stats.agentEarned)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>ETB of Net Cash Flow</div>
          </div>

          {/* Company Earned From This Branch */}
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>COMPANY SHARE (80%)</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#fbbf24' }}>{fmt(stats.companyEarnedFromBranch)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>ETB from branch</div>
          </div>

          {/* Real Ticket Sales (Base) */}
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>REAL TICKET SALES (CASH ONLY)</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>{fmt(stats.totalTicketSales)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>{fmtInt(stats.totalTicketsCount)} tickets sold</div>
          </div>

          {/* Real Cash Deposited */}
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>TOTAL REAL DEPOSITS</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa' }}>{fmt(stats.totalDeposited)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Physical ETB collected</div>
          </div>

          {/* Net Cash Flow */}
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>NET CASH FLOW</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: stats.netCashFlow >= 0 ? '#4ade80' : '#f87171' }}>
              {stats.netCashFlow >= 0 ? '+' : ''}{fmt(stats.netCashFlow)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Deposits − Withdrawals</div>
          </div>

          {/* Bot Win (Real Cash) */}
          <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(239,68,68,0.35)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>BOT WIN (REAL CASH)</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#f87171' }}>{fmt(stats.botDebtAdded || 0)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>From real player tickets only</div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────── */}
      {/* Removed per user request */}

      {/* ── HISTORICAL DATA WARNING BANNER ──────────────────── */}
      {currentPeriodStart && new Date(currentPeriodStart) < new Date('2026-06-22T00:00:00Z') && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start'
        }}>
          <FiAlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400e', marginBottom: '4px' }}>Historical Data Accuracy Warning</div>
            <div style={{ fontSize: '13px', color: '#b45309', lineHeight: '1.5' }}>
              The current period started before <strong>June 22, 2026</strong>. Prior to this date, the system allowed Bonus ETB to be used before Real ETB, which artificially inflates the "Real Ticket Sales" metrics for old transactions. Proceed with caution when settling old periods.
            </div>
          </div>
        </div>
      )}

      {/* ── ALL-TIME COLLECTION SUMMARY STRIP ───────────────── */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px',
        background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '14px', padding: '20px',
        border: '1px solid #047857', color: 'white'
      }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#a7f3d0', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>✅ All-Time Collected from {agent.firstName}</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{fmt(allTimeCollected || 0)} ETB</div>
          <div style={{ fontSize: '12px', color: '#d1fae5', marginTop: '4px' }}>{(allSettlements || []).length} physical cash collection(s) recorded</div>
        </div>
        <div style={{ flex: 1, minWidth: '160px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#a7f3d0', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>📅 Current Period Started</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>
            {currentPeriodStart ? new Date(currentPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Since account created'}
          </div>
          <div style={{ fontSize: '12px', color: '#d1fae5', marginTop: '4px' }}>Figures below cover only this active period</div>
        </div>
        <div style={{ flex: 1, minWidth: '160px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '20px', background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '10px', marginLeft: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#fca5a5', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🔴 Outstanding This Period</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#fecaca', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{fmt(Math.max(0, stats.netCashFlow - stats.agentEarned))} ETB</div>
          <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>Not yet collected</div>
        </div>
      </div>


      {/* ── REAL MONEY COLLECTION CARD ──────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #fff7ed, #fffbeb)',
        borderRadius: '20px', padding: '24px 28px', marginBottom: '24px',
        border: '2px solid #d4af37',
        boxShadow: '0 4px 20px rgba(212,175,55,0.2)',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '900', color: '#92400e', letterSpacing: '2px', marginBottom: '16px', textTransform: 'uppercase' }}>
          💰 Real Money Collection Breakdown for {agent.firstName}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>⬇️ Real Deposited</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d' }}>{fmt(stats.totalDeposited)} ETB</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>⬆️ Withdrawn</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#ef4444' }}>- {fmt(stats.totalWithdrawn)} ETB</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>💵 Net Cash Flow</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d' }}>{fmt(stats.netCashFlow)} ETB</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>🤝 Agent Commission</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#d97706' }}>- {fmt(stats.agentEarned)} ETB</div>
          </div>
        </div>
        <div style={{ background: '#fff8e1', border: '2px solid #fbbf24', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#92400e', letterSpacing: '1px' }}>TOTAL EXPECTED CASH TO COLLECT</div>
            <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Net Cash Flow ({fmt(stats.netCashFlow)}) − Agent Earnings ({fmt(stats.agentEarned)})</div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#b45309' }}>{fmt(Math.max(0, stats.netCashFlow - stats.agentEarned))} ETB</div>
        </div>
        {(stats.botDebtAdded || 0) > 0 && (
          <div style={{ marginTop: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#991b1b', letterSpacing: '1px' }}>🤖 BOT WIN ADVANTAGE (from real players)</div>
              <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>70% of real ticket sales won by house bots — already included in the above collection</div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#dc2626' }}>{fmt(stats.botDebtAdded)} ETB</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #f0ece8', marginBottom: '24px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: activeTab === t.key ? '#3d2b1f' : 'transparent',
              color: activeTab === t.key ? 'white' : '#78716c',
              border: 'none', borderRadius: '10px 10px 0 0',
              padding: '10px 18px', fontWeight: '800', fontSize: '13px',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Monthly Trend Chart */}
          {monthlyTrend && monthlyTrend.length > 0 && (
            <div className="premium-card">
              <h3 className="premium-card-title" style={{ marginBottom: '20px' }}>📈 6-Month Branch Performance</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px' }}>
                {monthlyTrend.map((m: any, i: number) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#d4af37' }}>{fmt(m.agentProfit).split('.')[0]}</div>
                    <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '110px' }}>
                      <div style={{ flex: 1, background: '#10b981', borderRadius: '4px 4px 0 0', height: `${Math.round((m.deposits / maxTrend) * 100)}%`, minHeight: m.deposits > 0 ? '4px' : '0', transition: 'height 0.5s' }} title={`Deposits: ${fmt(m.deposits)} ETB`} />
                      <div style={{ flex: 1, background: '#d4af37', borderRadius: '4px 4px 0 0', height: `${Math.round((m.ticketSales / maxTrend) * 100)}%`, minHeight: m.ticketSales > 0 ? '4px' : '0', transition: 'height 0.5s' }} title={`Ticket Sales: ${fmt(m.ticketSales)} ETB`} />
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#78716c', textAlign: 'center' }}>{m.month}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#78716c', fontWeight: '700' }}><div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} /> Deposits</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#78716c', fontWeight: '700' }}><div style={{ width: '10px', height: '10px', background: '#d4af37', borderRadius: '2px' }} /> Ticket Sales</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Profit Calculation Card */}
            <div className="premium-card">
              <h3 className="premium-card-title">How Agent Profit is Calculated</h3>
              <table className="premium-table" style={{ marginTop: '12px' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#8c857b' }}>Net Cash Flow (Deposits − Withdrawals)</td>
                    <td className="text-right" style={{ fontWeight: '800', color: '#15803d' }}>{fmt(Math.max(0, stats.netCashFlow))} ETB</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#8c857b' }}>Agent Profit Rate</td>
                    <td className="text-right" style={{ fontWeight: '800' }}>{fmtPct(stats.agentRate)}</td>
                  </tr>
                  <tr style={{ background: 'rgba(212,175,55,0.06)' }}>
                    <td style={{ fontWeight: '700', color: '#3d2b1f' }}>→ Agent Share ({fmtPct(stats.agentRate)} of Net Cash Flow)</td>
                    <td className="text-right" style={{ fontWeight: '900', color: '#d4af37', fontSize: '15px' }}>{fmt(stats.agentEarned)} ETB</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#8c857b' }}>→ Company Share (Net Cash Flow − Agent Earned)</td>
                    <td className="text-right" style={{ fontWeight: '800', color: '#78716c' }}>{fmt(stats.companyEarnedFromBranch)} ETB</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #f0ece8' }}>
                    <td style={{ color: '#8c857b' }}>Real Ticket Sales (for reference)</td>
                    <td className="text-right" style={{ fontWeight: '800' }}>{fmt(stats.totalTicketSales)} ETB</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#8c857b' }}>Commission Deducted (Actual)</td>
                    <td className="text-right" style={{ fontWeight: '800', color: Math.abs(stats.totalCommissionDeducted - stats.totalCommissionExpected) < 1 ? '#22c55e' : '#f59e0b' }}>
                      {fmt(stats.totalCommissionDeducted)} ETB
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#8c857b' }}>
                      Prizes Won by Players
                      <span style={{ marginLeft: '6px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>REAL ONLY</span>
                    </td>
                    <td className="text-right" style={{ fontWeight: '800', color: '#ef4444' }}>-{fmt(stats.totalPrizesWon)} ETB</td>
                  </tr>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ fontWeight: '800', color: '#3d2b1f' }}>House Edge (Sales − Prizes)</td>
                    <td className="text-right" style={{ fontWeight: '900', color: stats.houseEdge >= 0 ? '#22c55e' : '#ef4444', fontSize: '15px' }}>
                      {fmt(stats.houseEdge)} ETB
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid #fde68a', display: 'flex', gap: '8px' }}>
                <FiInfo size={14} style={{ color: '#ca8a04', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#713f12', lineHeight: '1.5' }}>
                  <strong>Prizes Won by Players</strong> = <em>REAL player prize payouts only</em>. Bot wins are <strong>never</strong> recorded as PRIZE_WIN transactions — when a bot wins, the money stays in the company system wallet. Bot prizes are tracked separately in the Bot Advantage Debt section below.
                </span>
              </div>
            </div>

            {/* Top Players */}
            <div className="premium-card">
              <h3 className="premium-card-title">🏆 Top Real Money Depositors</h3>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topPlayers && topPlayers.length > 0 ? topPlayers.map((p: any, i: number) => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: i === 0 ? '#fffbeb' : '#fafaf9', borderRadius: '10px', border: i === 0 ? '1px solid #fde68a' : '1px solid #f5f5f4' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i === 0 ? '#d4af37' : '#e7e5e4', color: i === 0 ? 'white' : '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '13px' }}>{p.name}</div>
                      {p.username && <div style={{ fontSize: '11px', color: '#78716c' }}>@{p.username}</div>}
                    </div>
                    <div style={{ fontWeight: '900', color: '#15803d', fontSize: '14px' }}>{fmt(p.totalDeposited)} ETB</div>
                  </div>
                )) : (
                  <p style={{ color: '#a8a29e', textAlign: 'center', padding: '20px', fontWeight: '600' }}>No deposit data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS TAB REMOVED ─────────────────────────── */}

      {/* ── PLAYERS TAB ─────────────────────────────────────── */}
      {activeTab === 'players' && (
        <div className="data-table-container">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f5f5f4' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>Branch Player Directory</h2>
            <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: '13px' }}>
              {players.length} real players · {stats.botCount} bots excluded from all calculations
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Phone</th>
                <th>Wallet Balance</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e', fontWeight: '600' }}>No players in this branch yet.</td></tr>
              ) : players.map((player: any, i: number) => (
                <tr key={player.id}>
                  <td style={{ color: '#78716c', fontSize: '13px' }}>#{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>{player.firstName?.[0] || 'U'}</div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '13px' }}>{player.firstName}</div>
                        <div style={{ fontSize: '11px', color: '#78716c' }}>@{player.telegramUsername || 'no_username'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: '#5c554b', fontSize: '13px' }}>{player.phone || 'N/A'}</td>
                  <td style={{ fontWeight: '800' }}>{fmt(player.wallet?.balance || 0)} ETB</td>
                  <td style={{ color: '#78716c', fontSize: '12px' }}>{new Date(player.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${player.status === 'BANNED' ? 'badge-red' : 'badge-green'}`}>
                      {player.status || 'ACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── WALLET & COMMISSION TAB ──────────────────────────── */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Pre-Deposit Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="premium-stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="card-label" style={{ color: '#166534' }}>TOTAL REFILLS (ADMIN)</div>
              <div className="card-value" style={{ color: '#15803d' }}>+{fmt(preDepositWallet?.totalRecharged)} ETB</div>
              <div className="card-subtext">Money added to reserve</div>
            </div>
            <div className="premium-stat-card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div className="card-label" style={{ color: '#991b1b' }}>TOTAL DEBITED (COMMISSION)</div>
              <div className="card-value" style={{ color: '#dc2626' }}>-{fmt(preDepositWallet?.totalDebited)} ETB</div>
              <div className="card-subtext">{fmtInt(stats.commissionDebitsCount)} commission deductions</div>
            </div>
            <div className="premium-stat-card" style={{ background: stateBg, border: `1px solid ${stateBorder}` }}>
              <div className="card-label" style={{ color: stateColor }}>CURRENT BALANCE</div>
              <div className="card-value" style={{ color: stateColor }}>{fmt(preDepositWallet?.balance)} ETB</div>
              <div className="card-subtext">{preDepositStatus.state === 'GREEN' ? 'Healthy reserve' : preDepositStatus.state === 'YELLOW' ? 'Running low — refill soon' : '⚠️ Critical — refill now!'}</div>
            </div>
          </div>

          {/* ── Physical Cash Collection ── */}
          <div className="premium-card" style={{ border: '1px solid #ef4444', background: '#fffcfc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FiAlertTriangle size={18} style={{ color: '#ef4444' }} />
              <h3 className="premium-card-title" style={{ color: '#ef4444', margin: 0 }}>Physical Cash Collection</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#5c554b', marginBottom: '16px', lineHeight: '1.5' }}>
              The Agent holds the net cash deposited by players. After deducting their commission, the remaining balance must be collected in real life.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#faf8f5', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#8c857b', textTransform: 'uppercase' }}>Net Cash Flow</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#3d2b1f' }}>{fmt(stats.netCashFlow)} ETB</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Agent Earnings (Deducted)</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>- {fmt(stats.agentEarned)} ETB</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Expected Cash To Collect</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#b91c1c' }}>{fmt(stats.netCashFlow - stats.agentEarned)} ETB</div>
              </div>
            </div>

            {(stats.netCashFlow - stats.agentEarned) > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px' }}>SETTLE AMOUNT (CASH RECEIVED)</label>
                  <input
                    type="number"
                    min="1"
                    max={stats.netCashFlow - stats.agentEarned}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder={`e.g. ${stats.netCashFlow - stats.agentEarned}`}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d4d4d8', fontSize: '14px', fontWeight: '700', outline: 'none' }}
                  />
                </div>
                <button
                  onClick={handleSettleDebt}
                  disabled={isSettling || !settleAmount || Number(settleAmount) <= 0}
                  style={{
                    background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px',
                    fontWeight: '800', cursor: 'pointer', transition: 'background 0.2s', opacity: (isSettling || !settleAmount) ? 0.6 : 1
                  }}
                >
                  {isSettling ? 'Collecting...' : 'Mark as Received & Reset Period'}
                </button>
              </div>
            )}
          </div>

          {/* ── Settlement History ── */}
          {allSettlements && allSettlements.length > 0 && (
            <div className="data-table-container" style={{ overflow: 'hidden', marginBottom: '0' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', background: '#f9f5ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#3d2b1f' }}>🗂️ Cash Collection History</h3>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#d4af37', background: 'rgba(212,175,55,0.1)', padding: '4px 10px', borderRadius: '8px' }}>
                  Total Collected: {fmt(allTimeCollected || 0)} ETB
                </span>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Amount Collected</th>
                      <th>Period</th>
                      <th>Collection Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSettlements.map((s: any, i: number) => (
                      <tr key={s.id}>
                        <td style={{ color: '#78716c', fontSize: '12px' }}>#{i + 1}</td>
                        <td><span style={{ fontWeight: '900', color: '#15803d', fontSize: '14px' }}>+{fmt(s.amount)} ETB</span></td>
                        <td style={{ fontSize: '11px', color: '#5c554b' }}>
                          {new Date(s.periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                          {' → '}
                          {new Date(s.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td style={{ fontSize: '12px', color: '#78716c' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Commission Audit */}
          <div className="premium-card">
            <h3 className="premium-card-title">📋 Commission Audit</h3>
            <table className="premium-table" style={{ marginTop: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#8c857b' }}>Real Ticket Sales (commission base)</td>
                  <td className="text-right" style={{ fontWeight: '800', color: '#15803d' }}>{fmt(stats.totalTicketSales)} ETB</td>
                </tr>
                <tr>
                  <td style={{ color: '#8c857b' }}>Full Commission Rate</td>
                  <td className="text-right" style={{ fontWeight: '800' }}>{fmtPct(stats.fullCommissionRate)}</td>
                </tr>
                <tr style={{ background: 'rgba(212,175,55,0.05)' }}>
                  <td style={{ fontWeight: '700' }}>Expected Commission Total</td>
                  <td className="text-right" style={{ fontWeight: '900' }}>{fmt(stats.totalCommissionExpected)} ETB</td>
                </tr>
                <tr style={{ background: Math.abs(stats.totalCommissionDeducted - stats.totalCommissionExpected) > 1 ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)' }}>
                  <td style={{ fontWeight: '700' }}>Actual Commission Deducted</td>
                  <td className="text-right" style={{ fontWeight: '900', color: Math.abs(stats.totalCommissionDeducted - stats.totalCommissionExpected) > 1 ? '#ef4444' : '#22c55e' }}>
                    {fmt(stats.totalCommissionDeducted)} ETB
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#8c857b' }}>Variance</td>
                  <td className="text-right" style={{ fontWeight: '800', color: Math.abs(stats.totalCommissionDeducted - stats.totalCommissionExpected) < 1 ? '#22c55e' : '#f59e0b' }}>
                    {fmt(Math.abs(stats.totalCommissionDeducted - stats.totalCommissionExpected))} ETB
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Recharge History */}
            <div className="data-table-container" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>💳 Admin Refill History</h3>
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Amount</th><th>Note</th><th>Date</th></tr></thead>
                  <tbody>
                    {!rechargeHistory || rechargeHistory.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: '#a8a29e' }}>No refills yet.</td></tr>
                    ) : rechargeHistory.map((rh: any, i: number) => (
                      <tr key={rh.id}>
                        <td style={{ color: '#78716c', fontSize: '12px' }}>#{i + 1}</td>
                        <td><span style={{ fontWeight: '900', color: '#16a34a' }}>+{fmt(rh.amount)} ETB</span></td>
                        <td style={{ fontSize: '12px', color: '#5c554b' }}>{rh.description || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#78716c' }}>{new Date(rh.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commission Debits Log */}
            <div className="data-table-container" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', background: '#fafaf9' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>📤 Commission Deductions Log</h3>
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Amount</th><th>Note</th><th>Date</th></tr></thead>
                  <tbody>
                    {!commissionDebits || commissionDebits.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: '#a8a29e' }}>No deductions yet.</td></tr>
                    ) : commissionDebits.map((cd: any, i: number) => (
                      <tr key={cd.id}>
                        <td style={{ color: '#78716c', fontSize: '12px' }}>#{i + 1}</td>
                        <td><span style={{ fontWeight: '900', color: '#dc2626' }}>-{fmt(cd.amount)} ETB</span></td>
                        <td style={{ fontSize: '12px', color: '#5c554b' }}>{cd.description || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#78716c' }}>{new Date(cd.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <BunaModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        onConfirm={executeSettleDebt}
        title="Confirm Cash Collection"
        message={`Are you sure you received ${Number(settleAmount)} ETB in physical cash from this agent? This action will reset their reporting period.`}
        type="confirm"
        confirmText="Yes, Collect Cash"
      />

      <BunaModal
        isOpen={showUndoModal}
        onClose={() => setShowUndoModal(false)}
        onConfirm={executeUndoCollect}
        title="Undo Last Collection"
        message="Are you sure you want to UNDO the last cash collection? This will restore the previous dashboard totals and reverse the last debt settlement."
        type="confirm"
        confirmText="Yes, Undo Collection"
      />
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="premium-stat-card">
      <div className="card-top-row">
        <div className="card-icon-container" style={{ background: `${color}15`, color }}>{icon}</div>
      </div>
      <div className="card-body">
        <div className="card-label">{label}</div>
        <div className="card-value" style={{ fontSize: '18px' }}>{value}</div>
        <div className="card-subtext">{sub}</div>
      </div>
    </div>
  );
}
