"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiSearch, FiUserPlus, FiUserX, FiX, FiLock, FiPhone, FiUser, FiAlertCircle, FiTrash2, FiPlus, FiEdit2, FiDollarSign, FiBarChart2, FiDownload } from 'react-icons/fi';
import api from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import BunaModal from '@/components/BunaModal';
import '@/app/admin.css';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [newStaff, setNewStaff] = useState({ telegramId: '', username: '', firstName: '', role: 'AGENT', password: '' });

  // Deposit Phones Modal State
  const [showDepositPhonesModal, setShowDepositPhonesModal] = useState(false);
  const [depositPhonesLoading, setDepositPhonesLoading] = useState(false);
  const [depositPhonesSuccess, setDepositPhonesSuccess] = useState('');
  const [depositPhonesError, setDepositPhonesError] = useState('');
  const [agentDepositPhones, setAgentDepositPhones] = useState<{name: string, phone: string, last4: string}[]>([]);

  // Demote Agent Modal State
  const [demoteModal, setDemoteModal] = useState<{isOpen: boolean, userId: string}>({ isOpen: false, userId: '' });

  // Edit Agent Modal State
  const [editModal, setEditModal] = useState(false);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ firstName: '', telegramUsername: '', phone: '', preDepositBalance: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, title: string, message: string, type: 'info' | 'error' | 'success' | 'confirm' | 'balance'}>({ isOpen: false, title: '', message: '', type: 'info' });
  const [discountRate, setDiscountRate] = useState(0.20);

  // Players Modal State
  const [playersModal, setPlayersModal] = useState(false);
  const [playersAgent, setPlayersAgent] = useState<any>(null);
  const [agentPlayers, setAgentPlayers] = useState<any[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const openPlayersModal = async (agent: any) => {
    setPlayersAgent(agent);
    setPlayersModal(true);
    setPlayersLoading(true);
    try {
      const res = await api.get(`/admin/users?referredBy=${agent.id}&limit=1000`);
      setAgentPlayers(res.data.users || []);
    } catch {
      setAgentPlayers([]);
    } finally {
      setPlayersLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [page]);

  useEffect(() => {
    fetchDiscountRate();
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setIsAdmin(payload.role === 'ADMIN' || payload.isAdmin);
      }
    } catch (e) {}
  }, []);

  async function fetchDiscountRate() {
    try {
      const res = await api.get('/admin/settings');
      const compRate = parseFloat(res.data.COMPANY_COMMISSION_RATE) || 30;
      const agentRate = parseFloat(res.data.AGENT_PROFIT_RATE) || 6;
      if (compRate > 0) {
        setDiscountRate(agentRate / compRate);
      }
    } catch (err) {
      console.error('Failed to fetch settings/discount rate:', err);
    }
  }

  async function fetchAgents() {
    try {
      setLoading(true);
      const response = await api.get(`/admin/agents?page=${page}`);
      setAgents(response.data.agents || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleRecharge = async () => {
    if (!selectedAgent || !rechargeAmount) return;
    try {
      setRechargeLoading(true);
      await api.post(`/admin/agents/${selectedAgent.id}/recharge`, { amount: rechargeAmount });
      setShowRechargeModal(false);
      setRechargeAmount('');
      fetchAgents();
      setAlertModal({ isOpen: true, title: 'Success', message: `Successfully refilled ${selectedAgent.firstName}'s wallet!`, type: 'success' });
    } catch (err: any) {
      setAlertModal({ isOpen: true, title: 'Error', message: err.response?.data?.error || 'Recharge failed.', type: 'error' });
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleDemote = (userId: string) => {
    setDemoteModal({ isOpen: true, userId });
  };

  const executeDemote = async () => {
    try {
      await api.post(`/admin/users/${demoteModal.userId}/demote`);
      fetchAgents();
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Demotion failed.', type: 'error' });
    } finally {
      setDemoteModal({ isOpen: false, userId: '' });
    }
  };

  const openEditModal = (agent: any) => {
    setEditAgent(agent);
    setEditForm({
      firstName: agent.firstName || '',
      telegramUsername: agent.telegramUsername || '',
      phone: agent.phone || agent.phoneNumber || '',
      preDepositBalance: Number(agent.preDepositStatus?.balance ?? agent.agentPreDepositWallet?.balance ?? 0).toFixed(2),
    });
    setEditError('');
    setEditSuccess('');
    setEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editAgent) return;
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      await api.patch(`/admin/agents/${editAgent.id}`, editForm);
      setEditSuccess('✅ Agent updated successfully!');
      fetchAgents();
      setTimeout(() => setEditModal(false), 1500);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    setCreateError('');
    setCreateSuccess('');
    if (!newStaff.telegramId || !newStaff.username || !newStaff.password) {
      setCreateError('Telegram ID, username and password are required.');
      return;
    }
    setCreateLoading(true);
    try {
      await api.post('/admin/staff/create', newStaff);
      setCreateSuccess(`✅ @${newStaff.username} created successfully as ${newStaff.role}!`);
      setNewStaff({ telegramId: '', username: '', firstName: '', role: 'AGENT', password: '' });
      fetchAgents();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create staff member.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openDepositPhonesModal = (agent: any) => {
    setSelectedAgent(agent);
    setDepositPhonesSuccess('');
    setDepositPhonesError('');
    
    // Safely parse depositPhones in case it's stringified JSON from the database
    let phones = [];
    if (Array.isArray(agent.depositPhones)) {
      phones = [...agent.depositPhones];
    } else if (typeof agent.depositPhones === 'string') {
      try {
        phones = JSON.parse(agent.depositPhones);
      } catch (e) {}
    }
    
    // Auto-populate with at least one empty row if no phones exist
    if (phones.length === 0) {
      phones = [{ name: '', phone: '', last4: '' }];
    }
    
    setAgentDepositPhones(phones);
    setShowDepositPhonesModal(true);
  };

  const handleSaveDepositPhones = async () => {
    if (!selectedAgent) return;
    setDepositPhonesLoading(true);
    setDepositPhonesSuccess('');
    setDepositPhonesError('');
    try {
      await api.patch(`/admin/agents/${selectedAgent.id}/deposit-phones`, {
        depositPhones: agentDepositPhones
      });
      fetchAgents();
      setDepositPhonesSuccess(`Successfully updated deposit phones for ${selectedAgent.firstName}!`);
      setTimeout(() => setShowDepositPhonesModal(false), 2000);
    } catch (err: any) {
      setDepositPhonesError(err.response?.data?.error || 'Failed to update deposit phones.');
    } finally {
      setDepositPhonesLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateAllAgentsPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;

    let profitData: any = null;
    try {
      const res = await api.get('/admin/company-profit?range=all');
      profitData = res.data;
    } catch (e) {
      alert('Failed to load profit data for PDF.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth  = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const fmt    = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (r: number) => (r * 100).toFixed(1) + '%';

    // ── Load Amharic font ──────────────────────────────────────
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

    // ── DARK HEADER BAR ──────────────────────────────────────
    doc.setFillColor(61, 43, 31);
    doc.rect(0, 0, pageWidth, 26, 'F');
    // Gold accent line
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 26, pageWidth, 1.5, 'F');

    // Logo
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 60; canvas.height = 60;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.beginPath(); ctx.arc(30, 30, 30, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
            ctx.drawImage(img, 0, 0, 60, 60);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 8, 4, 18, 18);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = '/logo.png';
      });
    } catch (e) {}

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55);
    doc.text('BUNA BINGO', 30, 13);
    doc.setFontSize(8);
    doc.setTextColor(180, 160, 120);
    doc.text('BUNA TECH HUB', 30, 20);

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('ALL AGENTS — CASH COLLECTION SUMMARY', pageWidth - 10, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(180, 160, 120);
    doc.text(`Generated: ${new Date().toLocaleString()}  ·  Real Cash Only — Bonus ETB excluded`, pageWidth - 10, 20, { align: 'right' });

    // ── HERO TOTALS CARD ──────────────────────────────────────
    const totals = profitData?.totals || {};
    const totalExpected = Math.max(0, (totals.netCashFlow || 0) - (totals.agentEarned || 0));

    doc.setFillColor(212, 175, 55);
    doc.roundedRect(10, 31, pageWidth - 20, 26, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 50, 10);
    doc.text('TOTAL EXPECTED CASH FROM ALL AGENTS', pageWidth / 2, 37, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(100, 70, 20);
    doc.text('Real Cash Only  -  Bonus ETB Excluded', pageWidth / 2, 43, { align: 'center' });
    doc.setFontSize(20);
    doc.setTextColor(61, 43, 31);
    doc.text(`${fmt(totalExpected)} ETB`, pageWidth / 2, 52, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    // ── 5 SUMMARY BOXES ─────────────────────────────────────
    const boxData = [
      { label: 'TOTAL REAL DEPOSITS', value: fmt(totals.totalDeposited || 0) + ' ETB', color: [21, 128, 61] as [number,number,number] },
      { label: 'TOTAL WITHDRAWN',     value: fmt(totals.totalWithdrawn  || 0) + ' ETB', color: [185, 28, 28] as [number,number,number] },
      { label: 'NET CASH FLOW',       value: fmt(totals.netCashFlow     || 0) + ' ETB', color: [14, 100, 57] as [number,number,number] },
      { label: 'AGENT COMMISSIONS',   value: fmt(totals.agentEarned     || 0) + ' ETB', color: [180, 83, 9] as [number,number,number] },
    ];
    const bw = (pageWidth - 20 - 12) / 4;
    const by0 = 60;
    boxData.forEach((b, i) => {
      const bx = 10 + i * (bw + 4);
      doc.setFillColor(61, 43, 31);
      doc.setDrawColor(...b.color);
      doc.setLineWidth(0.8);
      doc.roundedRect(bx, by0, bw, 16, 2, 2, 'FD');
      doc.setFontSize(6);
      doc.setTextColor(180, 160, 120);
      doc.text(b.label, bx + bw / 2, by0 + 5, { align: 'center' });
      doc.setFontSize(8.5);
      doc.setTextColor(...b.color);
      doc.text(b.value, bx + bw / 2, by0 + 12, { align: 'center' });
    });

    // ── PER-AGENT TABLE ──────────────────────────────────────
    const agentRows = (profitData?.agents || []).map((a: any, i: number) => {
      const exp   = Math.max(0, a.netCashFlow - a.agentEarned);
      const isHigh = exp > 1000;
      return [
        { content: String(i + 1), styles: { textColor: [120, 113, 108] as [number, number, number], halign: 'center' as const } },
        { content: a.agentName || '-', styles: { textColor: [61, 43, 31] as [number,number,number], fontStyle: 'bold' as const } },
        { content: a.agentUsername ? `@${a.agentUsername}` : '—', styles: { textColor: [140, 130, 120] as [number,number,number] } },
        { content: `+ ${fmt(a.totalDeposited)} ETB`, styles: { textColor: [21, 128, 61] as [number,number,number], halign: 'right' as const } },
        { content: `- ${fmt(a.totalWithdrawn || 0)} ETB`, styles: { textColor: [185, 28, 28] as [number,number,number], halign: 'right' as const } },
        { content: `${fmt(a.netCashFlow)} ETB`, styles: { textColor: [14, 100, 57] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: `- ${fmt(a.agentEarned)} ETB`, styles: { textColor: [180, 83, 9] as [number,number,number], halign: 'right' as const } },
        {
          content: `${fmt(exp)} ETB`,
          styles: {
            fontStyle: 'bold' as const,
            textColor: isHigh ? [185, 28, 28] as [number,number,number] : [21, 128, 61] as [number,number,number],
            fillColor: isHigh ? [254, 242, 242] as [number,number,number] : [240, 253, 244] as [number,number,number],
            halign: 'right' as const,
          }
        },
      ];
    });

    // Totals row
    const totalExp = Math.max(0, (totals.netCashFlow || 0) - (totals.agentEarned || 0));
    agentRows.push([
      { content: 'SUM', styles: { textColor: [212, 175, 55] as [number,number,number], halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `TOTAL  (${(profitData?.agents || []).length} agents)`, styles: { textColor: [212, 175, 55] as [number,number,number], fontStyle: 'bold' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: '', styles: { fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `+ ${fmt(totals.totalDeposited || 0)} ETB`, styles: { textColor: [110, 231, 183] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `- ${fmt(totals.totalWithdrawn || 0)} ETB`, styles: { textColor: [252, 165, 165] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `${fmt(totals.netCashFlow || 0)} ETB`, styles: { textColor: [110, 231, 183] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `- ${fmt(totals.agentEarned || 0)} ETB`, styles: { textColor: [252, 211, 77] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const, fillColor: [61, 43, 31] as [number,number,number] } },
      { content: `${fmt(totalExp)} ETB`, styles: { textColor: [110, 231, 183] as [number,number,number], fontStyle: 'bold' as const, halign: 'right' as const, fillColor: [61, 43, 31] as [number,number,number] } },
    ]);

    autoTable(doc, {
      startY: 82,
      head: [[
        '#',
        'Agent Name',
        'Username',
        'Real Deposits',
        'Withdrawn',
        'Net Cash Flow',
        'Agent Earnings',
        'COLLECT FROM AGENT',
      ]],
      body: agentRows,
      theme: 'grid',
      headStyles: {
        fillColor: [61, 43, 31], textColor: [255, 255, 255],
        fontSize: 7.5, fontStyle: 'bold', halign: 'left',
        font: 'helvetica',
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        textColor: [55, 55, 55],
        font: 'helvetica',
      },
      alternateRowStyles: { fillColor: [252, 250, 248] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 38 },
        2: { cellWidth: 30, textColor: [120, 113, 108] },
        3: { cellWidth: 34, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 34, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 10, right: 10, bottom: 22 },
    });

    // ── FOOTER ON ALL PAGES ──────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.4);
      doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 133, 123);
      doc.text('BUNA TECH | bunatech.net | @Buna_BingoBot | @BunaTechHub', 10, pageHeight - 7);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
    }

    doc.save(`AllAgents_CashCollection_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, color: '#3d2b1f' }}>Agent Network</h1>
          <p style={{ color: 'var(--admin-text-muted)', marginTop: '4px' }}>Manage your branch managers and refill their pre-deposit liquidity.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={generateAllAgentsPDF}
            style={{
              background: 'linear-gradient(135deg, #d4af37, #b8922a)',
              color: 'white', border: 'none', borderRadius: '14px',
              padding: '12px 22px', fontWeight: '800', fontSize: '14px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(212,175,55,0.35)'
            }}
          >
            <FiDownload size={16} /> Export All Agents PDF
          </button>
          {isAdmin && (
            <button 
              className="login-button" 
              onClick={() => setShowCreateModal(true)}
              style={{ width: 'auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiUserPlus /> Create Agent / Admin
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="premium-stat-card">
          <div className="card-label">Total Agents</div>
          <div className="card-value">{totalCount || agents.length}</div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Active branch managers</div>
        </div>
        <div className="premium-stat-card">
          <div className="card-label">Pre-Deposit Liquidity</div>
          <div className="card-value" style={{ color: '#d4af37', fontSize: '20px' }}>
            {agents.reduce((acc, a) => acc + Number((a.preDepositStatus?.balance ?? a.agentPreDepositWallet?.balance) || 0), 0).toLocaleString()} ETB
          </div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Combined agent reserve</div>
        </div>
        <div className="premium-stat-card">
          <div className="card-label">Branch Players</div>
          <div className="card-value">{agents.reduce((acc, a) => acc + (a.referrals?.length ?? a._count?.referrals ?? 0), 0)}</div>
          <div style={{ fontSize: '12px', color: '#8c857b', marginTop: '4px' }}>Across all branches</div>
        </div>
      </div>

      {/* Critical Pre-Deposit Alert Banner */}
      {agents.filter(a => a.preDepositStatus?.state === 'RED').length > 0 && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '16px',
          padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '15px' }}>
            <FiAlertCircle size={20} /> CRITICAL: Pre-Deposit Recharge Required!
          </div>
          <p style={{ color: '#7f1d1d', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
            The following agents have critically low pre-deposit balances and cannot host/start games. Please refill their accounts immediately:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {agents.filter(a => a.preDepositStatus?.state === 'RED').map(a => (
              <span key={a.id} className="badge badge-red" style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '800' }}>
                {a.firstName} ({Number(a.preDepositStatus?.balance ?? a.agentPreDepositWallet?.balance ?? 0).toFixed(2)} ETB)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="data-table-container">
        <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center' }}>
          <div className="login-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
            <FiSearch className="login-input-icon" />
            <input 
              type="text" 
              placeholder="Search by name or @username..." 
              className="login-input" 
              style={{ padding: '12px 12px 12px 48px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Referral Code / Link</th>
              <th>Branch Players</th>
              <th>Pre-Deposit Balance</th>
              <th style={{ textAlign: 'right' }}>Net Cash Flow (Cash Only)</th>
              <th style={{ textAlign: 'right' }}>Agent Owes Players</th>
              <th style={{ textAlign: 'right', background: '#fff8e1', color: '#b45309', fontWeight: '900' }}>💰 Agent Owes Company</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
                  </td>
               </tr>
            ) : filteredAgents.length === 0 ? (
               <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>No agents matching your search.</td>
               </tr>
            ) : filteredAgents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{agent.firstName?.[0] || 'A'}</div>
                    <span style={{ fontWeight: '700' }}>{agent.firstName}</span>
                  </div>
                </td>
                <td>
                  {agent.referralCode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <code style={{ fontSize: '12px', fontWeight: '900', color: '#3d2b1f', background: 'rgba(212,175,55,0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.3)' }}>{agent.referralCode}</code>
                      <span style={{ fontSize: '10px', color: '#8c857b', wordBreak: 'break-all' }}>?start={agent.referralCode}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>⚠ No code</span>
                  )}
                </td>
                <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                      <span className="badge badge-blue">{agent.referrals?.length ?? agent._count?.referrals ?? 0} Players</span>
                      <button
                        onClick={() => openPlayersModal(agent)}
                        style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 10px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        👥 VIEW
                      </button>
                    </div>
                </td>
                <td>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <span style={{ fontWeight: '800', color: agent.preDepositStatus?.state === 'RED' ? '#ef4444' : agent.preDepositStatus?.state === 'YELLOW' ? '#f59e0b' : '#10b981' }}>
                       {Number(agent.preDepositStatus?.balance ?? agent.agentPreDepositWallet?.balance ?? 0).toLocaleString()} ETB
                     </span>
                     {agent.preDepositStatus?.state === 'RED' ? (
                       <span className="badge badge-red" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start' }}>CRITICAL</span>
                     ) : agent.preDepositStatus?.state === 'YELLOW' ? (
                       <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start', background: '#fef3c7', color: '#d97706' }}>LOW BALANCE</span>
                     ) : (
                       <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 6px', alignSelf: 'flex-start' }}>HEALTHY</span>
                     )}
                   </div>
                </td>
                  <td style={{ textAlign: 'right' }}>
                    {/* Net Cash Flow = branch deposits − branch withdrawals */}
                    {(() => {
                      const deps = Number(agent.wallet?.totalDeposited ?? 0);
                      const wds  = Number(agent.wallet?.totalWithdrawn ?? 0);
                      const net  = deps - wds;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                          <div style={{ fontWeight: '800', color: net >= 0 ? '#10b981' : '#ef4444', fontSize: '14px' }}>
                            {net >= 0 ? '+' : ''}{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </div>
                          <span style={{ fontSize: '10px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase' }}>Deposits – W/D</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      const debt = Number(agent.outstandingDebt ?? 0);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                          <div style={{ fontWeight: '800', color: debt > 0 ? '#ef4444' : '#10b981', fontSize: '14px' }}>
                            {debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </div>
                          <span style={{ fontSize: '10px', color: '#8c857b', fontWeight: '700', textTransform: 'uppercase' }}>
                            {debt > 0 ? 'Pending W/D' : 'All Settled'}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      const debt = Number(agent.outstandingCollectionDebt ?? 0);
                      const isHighDebt = debt > 1000;
                      return debt > 0 ? (
                        <div style={{
                          display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end',
                          background: isHighDebt ? '#fef2f2' : '#fff8e1',
                          padding: '6px 12px', borderRadius: '8px',
                          border: `1px solid ${isHighDebt ? '#fecaca' : '#fbbf24'}`
                        }}>
                          <div style={{ fontWeight: '900', color: isHighDebt ? '#ef4444' : '#b45309', fontSize: '14px' }}>
                            {isHighDebt ? '🔴' : '💰'} {debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </div>
                          <span style={{ fontSize: '10px', color: isHighDebt ? '#991b1b' : '#b45309', fontWeight: '800', marginTop: '2px' }}>
                            THIS PERIOD
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: '800', fontSize: '13px' }}>✅ Collected</span>
                      );
                    })()}
                  </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
                    <Link href={`/admin/agents/${agent.id}`}>
                      <button
                        style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="View Full Report"
                      >
                        <FiBarChart2 size={12} /> REPORT
                      </button>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => openEditModal(agent)}
                        style={{ background: '#fef9c3', color: '#854d0e', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Edit Agent"
                      >
                        <FiEdit2 size={12} /> EDIT
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        onClick={() => { setSelectedAgent(agent); setShowRechargeModal(true); }}
                        className="action-button"
                        style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                      >
                         REFILL
                      </button>
                    )}
                    <button 
                      onClick={() => openDepositPhonesModal(agent)}
                      style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                    >
                       <FiPhone size={12} style={{ marginRight: '4px' }} /> PHONES
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDemote(agent.id)}
                        style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                        title="Demote from Agent"
                      >
                         <FiUserX />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
        loading={loading}
      />

      <BunaModal 
        isOpen={demoteModal.isOpen}
        onClose={() => setDemoteModal({ isOpen: false, userId: '' })}
        onConfirm={executeDemote}
        title="Remove Agent"
        message="Are you sure you want to remove this agent from the network? This action will demote them to a regular user."
        type="error"
        confirmText="Remove Agent"
      />

      {/* ── Recharge Modal ── */}
      {showRechargeModal && (
        <div className="modal-overlay">
           <div className="modal-content">
              <h2 style={{ fontWeight: '900', fontSize: '24px', marginBottom: '10px' }}>Refill Agent Wallet</h2>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '20px' }}>
                 Recharging <b>{selectedAgent?.firstName}</b>'s pre-deposit balance.
              </p>
              
              <div className="login-input-wrapper" style={{ border: '2px solid #eee', marginBottom: '20px' }}>
                 <input 
                    type="number" 
                    placeholder="Enter amount in ETB..." 
                    className="login-input" 
                    style={{ color: 'black' }}
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                 />
              </div>

              {rechargeAmount && parseFloat(rechargeAmount) > 0 && (
                <div style={{ background: '#faf9f7', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #e7e5e4', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Digital Balance to add:</span>
                    <strong style={{ color: '#22c55e', fontWeight: '800' }}>{parseFloat(rechargeAmount).toLocaleString()} ETB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Cash to collect from Agent:</span>
                    <strong style={{ color: '#3d2b1f', fontWeight: '800' }}>{(parseFloat(rechargeAmount) * (1 - discountRate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                    <span style={{ fontWeight: '600' }}>Agent Profit (Margin):</span>
                    <strong style={{ color: '#d4af37', fontWeight: '800' }}>{(parseFloat(rechargeAmount) * discountRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                 <button 
                    className="login-button" 
                    onClick={handleRecharge}
                    disabled={rechargeLoading}
                    style={{ flex: 1, padding: '15px' }}
                 >
                    {rechargeLoading ? 'Refilling...' : 'Confirm Refill'}
                 </button>
                 <button 
                    onClick={() => setShowRechargeModal(false)}
                    style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}
      {/* ── Create Staff Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Create Agent / Staff / Admin</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>Create a staff member directly — no Telegram bot interaction needed.</p>

            {createError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{createError}</div>}
            {createSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{createSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiPhone size={10} /> Telegram ID</label>
                  <input type="number" className="login-input" placeholder="e.g. 6836036070" value={newStaff.telegramId} onChange={e => setNewStaff(s => ({ ...s, telegramId: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Username</label>
                  <input type="text" className="login-input" placeholder="e.g. agent_john" value={newStaff.username} onChange={e => setNewStaff(s => ({ ...s, username: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Full Name (optional)</label>
                <input type="text" className="login-input" placeholder="e.g. John Doe" value={newStaff.firstName} onChange={e => setNewStaff(s => ({ ...s, firstName: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Role</label>
                  <select className="login-input" value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="AGENT">Agent</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiLock size={10} /> Password</label>
                  <input type="password" className="login-input" placeholder="Min 6 characters" value={newStaff.password} onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleCreateStaff} disabled={createLoading} style={{ flex: 1, padding: '14px' }}>
                {createLoading ? 'Creating...' : 'Create Staff Member'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }} style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deposit Phones Modal ── */}
      {showDepositPhonesModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Deposit Phones</h2>
              <button onClick={() => setShowDepositPhonesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>
              Manage Telebirr/CBE deposit phone numbers for <b>{selectedAgent?.firstName}</b>. These will be shown to players depositing under this agent.
            </p>

            {depositPhonesError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{depositPhonesError}</div>}
            {depositPhonesSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{depositPhonesSuccess}</div>}

            {agentDepositPhones.map((phoneEntry, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px 40px', gap: '8px', marginBottom: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Account Name</label>
                  <input type="text" className="login-input" placeholder="e.g. LUEL" value={phoneEntry.name} onChange={e => {
                    const newPhones = [...agentDepositPhones];
                    newPhones[index].name = e.target.value;
                    setAgentDepositPhones(newPhones);
                  }} style={{ padding: '8px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                  <input type="text" className="login-input" placeholder="e.g. 251969455111" value={phoneEntry.phone} onChange={e => {
                    const val = e.target.value;
                    const newPhones = [...agentDepositPhones];
                    newPhones[index] = {
                      ...newPhones[index],
                      phone: val,
                      // Automate 'Last 4' extraction reliably
                      last4: val.length >= 4 ? val.slice(-4) : val
                    };
                    setAgentDepositPhones(newPhones);
                  }} style={{ padding: '8px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '4px' }}>Last 4</label>
                  <input type="text" className="login-input" value={phoneEntry.last4} readOnly style={{ padding: '8px', fontSize: '13px', background: '#f5f5f4', color: '#78716c' }} />
                </div>
                <button onClick={() => {
                  const newPhones = agentDepositPhones.filter((_, i) => i !== index);
                  setAgentDepositPhones(newPhones);
                }} style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '10px', borderRadius: '8px', cursor: 'pointer', height: '36px' }}>
                  <FiTrash2 />
                </button>
              </div>
            ))}

            <button onClick={() => setAgentDepositPhones([...agentDepositPhones, { name: '', phone: '', last4: '' }])} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px dashed #bbf7d0', width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              <FiPlus /> Add Phone Number
            </button>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleSaveDepositPhones} disabled={depositPhonesLoading} style={{ flex: 1, padding: '14px' }}>
                {depositPhonesLoading ? 'Saving...' : 'Save Deposit Phones'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Agent Modal ── */}
      {editModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '22px', margin: 0 }}>Edit Agent</h2>
              <button onClick={() => setEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#78716c' }}>
                <FiX />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#78716c', marginBottom: '20px' }}>
              Editing <b>{editAgent?.firstName}</b>{editAgent?.telegramUsername ? ` (@${editAgent.telegramUsername})` : ''}
            </p>

            {editError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{editError}</div>}
            {editSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{editSuccess}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Full Name</label>
                  <input type="text" className="login-input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. John" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiUser size={10} /> Username</label>
                  <input type="text" className="login-input" value={editForm.telegramUsername} onChange={e => setEditForm(f => ({ ...f, telegramUsername: e.target.value }))} placeholder="e.g. agent_john" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiPhone size={10} /> Phone</label>
                <input type="text" className="login-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0911234567" />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}><FiDollarSign size={10} /> Pre-Deposit Balance (ETB)</label>
                <input type="number" className="login-input" value={editForm.preDepositBalance} onChange={e => setEditForm(f => ({ ...f, preDepositBalance: e.target.value }))} placeholder="e.g. 5000" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button className="login-button" onClick={handleEditSave} disabled={editLoading} style={{ flex: 1, padding: '14px' }}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(false)} style={{ flex: 1, background: '#eee', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <BunaModal 
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* ── Players Modal ── */}
      {playersModal && playersAgent && (
        <div className="modal-overlay" onClick={() => setPlayersModal(false)}>
          <div className="modal-content" style={{ maxWidth: '580px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div>
                <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>👥 Branch Players</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#78716c' }}>
                  Agent: <b>{playersAgent.firstName}</b> &nbsp;·&nbsp;
                  <code style={{ fontSize: '11px', background: 'rgba(212,175,55,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{playersAgent.referralCode}</code>
                </p>
              </div>
              <button onClick={() => setPlayersModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#78716c' }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, marginTop: '12px' }}>
              {playersLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                  <p style={{ marginTop: '12px', color: '#78716c', fontWeight: '700' }}>Loading players...</p>
                </div>
              ) : agentPlayers.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#a8a29e' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                  <div style={{ fontWeight: '700' }}>No players under this agent yet.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#faf9f7', borderBottom: '2px solid #e7e5e4' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>Player</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>Telegram ID</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>Phone</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>Balance</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', color: '#78716c', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPlayers.map((player, i) => (
                      <tr key={player.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                        <td style={{ padding: '10px 12px', color: '#a8a29e', fontWeight: '700' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #d4af37, #b8922a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '12px', color: 'white', flexShrink: 0 }}>
                              {player.firstName?.[0] || 'U'}
                            </div>
                            <div>
                              <div style={{ fontWeight: '800', color: '#3d2b1f' }}>{player.firstName || '—'}</div>
                              <div style={{ fontSize: '11px', color: '#8c857b' }}>@{player.telegramUsername || 'no_username'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#78716c' }}>{player.telegramId?.toString()}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#78716c' }}>{player.phone || player.phoneNumber || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#3d2b1f' }}>
                          {parseFloat(player.wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '10px', color: '#d4af37' }}>ETB</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '800',
                            background: player.status === 'BANNED' ? '#fef2f2' : '#f0fdf4',
                            color: player.status === 'BANNED' ? '#ef4444' : '#16a34a'
                          }}>
                            {player.status || 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: '14px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#78716c', fontWeight: '600' }}>
                {agentPlayers.length} player{agentPlayers.length !== 1 ? 's' : ''} in this branch
              </span>
              <button onClick={() => setPlayersModal(false)} style={{ background: '#3d2b1f', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '900', cursor: 'pointer', fontSize: '13px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
