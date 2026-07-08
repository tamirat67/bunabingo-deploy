"use client";

import React, { useEffect, useState } from 'react';
import {
  FiSettings, FiDollarSign, FiPhone, FiUser, FiSave,
  FiAlertCircle, FiCoffee, FiTrendingUp, FiPercent, FiCheckCircle, FiEdit2, FiGift,
  FiBell, FiTrash2, FiSend, FiPlus, FiClock, FiCalendar, FiToggleLeft, FiToggleRight,
  FiX, FiChevronDown
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

interface SystemSettings {
  COMPANY_COMMISSION_RATE: string;
  AGENT_PROFIT_RATE: string;
  BONUS_ACTIVE: boolean;
  BONUS_PERCENT: string;
  BONUS_MIN_DEPOSIT: string;
  BONUS_EXPIRY: string;
  HOUSE_BOT_ENABLED: boolean;
}

interface Promotion {
  id: string;
  title: string;
  message: string;
  type: string;
  imageUrl?: string | null;
  isActive: boolean;
  scheduledAt: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'bonus' | 'promotions'>('general');

  const [settings, setSettings] = useState<SystemSettings>({
    COMPANY_COMMISSION_RATE: '12.5',
    AGENT_PROFIT_RATE: '12.5',
    BONUS_ACTIVE: true,
    BONUS_PERCENT: '100',
    BONUS_MIN_DEPOSIT: '50',
    BONUS_EXPIRY: '',
    HOUSE_BOT_ENABLED: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // UI state for Revenue Split (House Edge Model)
  const [houseEdgeRate, setHouseEdgeRate] = useState('30');
  const [agentSharePct, setAgentSharePct] = useState('20');

  const [appModal, setAppModal] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    isError?: boolean;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (title: string, message: string, isError = false) => {
    setAppModal({ isOpen: true, type: 'alert', title, message, isError });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setAppModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  // Promotions state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [promoForm, setPromoForm] = useState({ title: '', message: '', type: 'announcement', scheduledAt: '', expiresAt: '' });
  const [savingPromo, setSavingPromo] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState<boolean>(false);

  // ─── House Win Rate Protection ───
  const [houseProtection, setHouseProtection] = useState({ forceHouseWin: true, rouletteFix: true, bingoWinRate: 10, slotGambleWinChance: 5 });
  const [savingProtection, setSavingProtection] = useState(false);
  const [protectionSaved, setProtectionSaved] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchSettings();
    fetchPromotions();
    api.get('/admin/house-settings')
      .then(r => setHouseProtection({ forceHouseWin: r.data.forceHouseWin, rouletteFix: r.data.rouletteFix, bingoWinRate: r.data.bingoWinRate ?? 9, slotGambleWinChance: r.data.slotGambleWinChance ?? 5 }))
      .catch(e => console.error('Failed to load house settings:', e));
  }, []);

  const handleSaveProtection = async () => {
    setSavingProtection(true);
    try {
      await api.post('/admin/house-settings', houseProtection);
      setProtectionSaved(true);
      setTimeout(() => setProtectionSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save house protection:', e);
      showAlert('Error', 'Failed to save Win Rate settings.', true);
    } finally {
      setSavingProtection(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get('/admin/rooms');
      setRooms(res.data || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings({
        ...res.data,
        BONUS_PERCENT: res.data.BONUS_PERCENT || '100',
        BONUS_MIN_DEPOSIT: res.data.BONUS_MIN_DEPOSIT || '50',
        BONUS_EXPIRY: res.data.BONUS_EXPIRY || '',
        HOUSE_BOT_ENABLED: res.data.HOUSE_BOT_ENABLED !== false,
      });

      // Derive house margin UI values from stored rates (Upfront Discount Model)
      const compRate  = parseFloat(res.data.COMPANY_COMMISSION_RATE) || 30;
      const agentRate = parseFloat(res.data.AGENT_PROFIT_RATE) || 6;
      const totalEdge = compRate;
      const agentShare = totalEdge > 0 ? (agentRate / totalEdge) * 100 : 20;
      setHouseEdgeRate(totalEdge.toFixed(2).replace(/\.00$/, ''));
      setAgentSharePct(agentShare.toFixed(1).replace(/\.0$/, ''));
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchPromotions = async () => {
    try {
      const res = await api.get('/admin/promotions');
      setPromotions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch promotions:', err);
    } finally {
      setLoadingPromos(false);
    }
  };

  const handleUpdateRoom = async (roomId: string, data: any) => {
    setSavingRoom(roomId);
    try {
      await api.patch(`/admin/rooms/${roomId}`, data);
      await fetchRooms();
    } catch (err) {
      showAlert('Error', 'Update failed.', true);
    } finally {
      setSavingRoom(null);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsError('');
    const edge      = parseFloat(houseEdgeRate);
    const agentShr  = parseFloat(agentSharePct);

    if (isNaN(edge) || edge < 0 || edge > 100) {
      setSettingsError('House edge (% deducted per game) must be between 0% and 100%.');
      return;
    }
    if (isNaN(agentShr) || agentShr < 0 || agentShr > 100) {
      setSettingsError('Agent recharge discount must be between 0% and 100%.');
      return;
    }

    // In the Upfront Discount Model, the Company Commission is the FULL house edge
    const computedCompanyRate = edge;
    const computedAgentRate   = parseFloat((edge * agentShr / 100).toFixed(4));

    const payload = {
      ...settings,
      COMPANY_COMMISSION_RATE: String(computedCompanyRate),
      AGENT_PROFIT_RATE: String(computedAgentRate),
    };

    setSavingSettings(true);
    try {
      await api.put('/admin/settings', payload);
      setSettings(s => ({ ...s, COMPANY_COMMISSION_RATE: String(computedCompanyRate), AGENT_PROFIT_RATE: String(computedAgentRate) }));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      setSettingsError(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePromotion = async () => {
    if (!promoForm.title.trim() || !promoForm.message.trim()) {
      showAlert('Validation Error', 'Title and message are required.', true);
      return;
    }
    setSavingPromo(true);
    try {
      let payload: any;
      let isMultipart = false;

      if (imageFile) {
        isMultipart = true;
        payload = new FormData();
        payload.append('title', promoForm.title.trim());
        payload.append('message', promoForm.message.trim());
        payload.append('type', promoForm.type);
        payload.append('scheduledAt', promoForm.scheduledAt || '');
        payload.append('expiresAt', promoForm.expiresAt || '');
        payload.append('image', imageFile);
        if (editingPromo && removeImage) {
          payload.append('removeImage', 'true');
        }
      } else {
        payload = {
          title: promoForm.title.trim(),
          message: promoForm.message.trim(),
          type: promoForm.type,
          scheduledAt: promoForm.scheduledAt || '',
          expiresAt: promoForm.expiresAt || '',
        };
        if (editingPromo && removeImage) {
          payload.removeImage = true;
        }
      }

      const config: any = { timeout: 120000 };

      if (editingPromo) {
        await api.patch(`/admin/promotions/${editingPromo.id}`, payload, config);
      } else {
        await api.post('/admin/promotions', payload, config);
      }
      setShowPromoForm(false);
      setEditingPromo(null);
      setImageFile(null);
      setImageUrl(null);
      setRemoveImage(false);
      setPromoForm({ title: '', message: '', type: 'announcement', scheduledAt: '', expiresAt: '' });
      fetchPromotions();
      showAlert('Success', editingPromo ? 'Announcement updated successfully!' : 'Announcement created and broadcast started!');
    } catch (err: any) {
      let serverError = err.response?.data?.error || err.message || 'Failed to save announcement.';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        serverError = 'Request timed out (took longer than 2 minutes). Your internet connection might be slow, or the server is starting up. Please try again.';
      } else if (!err.response) {
        serverError = 'Cannot reach the server. Check your internet connection or the backend may be restarting.';
      }
      showAlert('Error', serverError, true);
      console.error('[Promotion Save Error]', err.response?.data || err);
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = (id: string) => {
    showConfirm('Delete Promotion', 'Delete this promotion? This cannot be undone.', async () => {
      setAppModal(prev => ({ ...prev, isOpen: false }));
      try {
        await api.delete(`/admin/promotions/${id}`);
        fetchPromotions();
      } catch (err) {
        showAlert('Error', 'Failed to delete promotion.', true);
      }
    });
  };

  const handleTogglePromo = async (promo: Promotion) => {
    try {
      // Send as JSON (plain object) — the backend PATCH now handles both
      // JSON and multipart requests correctly.
      await api.patch(
        `/admin/promotions/${promo.id}`,
        { isActive: !promo.isActive },
        { timeout: 15000 }
      );
      fetchPromotions();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to toggle announcement.';
      showAlert('Error', msg, true);
    }
  };

  const handleBroadcast = (id: string) => {
    showConfirm('Broadcast Message', 'Broadcast this message to ALL users? This action cannot be undone.', async () => {
      setAppModal(prev => ({ ...prev, isOpen: false }));
      setBroadcastingId(id);
      try {
        const res = await api.post(`/admin/promotions/${id}/broadcast`, {}, { timeout: 30000 });
        showAlert('Success', `Broadcast queued to ${res.data.totalRecipients} users!`);
        fetchPromotions();
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Failed to broadcast.';
        showAlert('Error', msg, true);
      } finally {
        setBroadcastingId(null);
      }
    });
  };

  // Computed values for UI Live Preview
  const edgeNum       = parseFloat(houseEdgeRate) || 0;
  const playerPrize   = (100 - edgeNum).toFixed(2);

  // Bonus expiry helpers
  const bonusExpiry = settings.BONUS_EXPIRY ? new Date(settings.BONUS_EXPIRY) : null;
  const bonusExpired = bonusExpiry ? bonusExpiry < new Date() : false;
  const bonusEffectivelyActive = settings.BONUS_ACTIVE && !bonusExpired;

  const tabs = [
    { key: 'general' as const, label: 'General', icon: FiSettings },
    { key: 'bonus' as const, label: 'Bonus & Promotions', icon: FiGift },
    { key: 'promotions' as const, label: 'Announcements', icon: FiBell },
  ];

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>System Control</h1>
        <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>
          Fine-tune your platform's financial rules, bonuses, and announcements
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', background: '#f5f5f4', borderRadius: '16px', padding: '4px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? '800' : '600',
              background: activeTab === tab.key ? '#ffffff' : 'transparent',
              color: activeTab === tab.key ? '#3d2b1f' : '#78716c',
              boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ GENERAL TAB ═══════════════ */}
      {activeTab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

            {/* Commission Rates */}
            <div className="stat-card-m" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FiPercent style={{ color: '#d4af37' }} /> Revenue Split Settings
              </h2>

              {/* Clear instruction box */}
              <div style={{ background: '#fffbeb', border: '2px solid #fbbf24', borderRadius: '14px', padding: '16px 18px', marginBottom: '24px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '700', lineHeight: '1.7' }}>
                  📌 <strong>HOW TO SET:</strong><br />
                  • <strong>House Edge per Game</strong> = the % deducted from agent wallet every game (e.g. <code>30</code> means 30 ETB taken from every 100 ETB collected).<br />
                  • <strong>Agent Recharge Discount</strong> = the % discount agent gets when topping up wallet (e.g. <code>20</code> means agent pays 8,000 ETB for 10,000 ETB balance).
                </p>
              </div>

              {loadingSettings ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🎮 House Edge per Game (%)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min="0" max="100" step="0.5"
                          className="login-input"
                          style={{ width: '100%', paddingRight: '40px', fontWeight: '800', fontSize: '18px' }}
                          value={houseEdgeRate}
                          onChange={(e) => setHouseEdgeRate(e.target.value)}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#d4af37' }}>%</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px', lineHeight: '1.4' }}>
                        ✅ Correct value: <strong>30</strong> (means 30% is deducted from agent wallet each game, 70% goes to prize pool).
                      </p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        👤 Agent Recharge Discount (%)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min="0" max="100" step="1"
                          className="login-input"
                          style={{ width: '100%', paddingRight: '40px', fontWeight: '800', fontSize: '18px' }}
                          value={agentSharePct}
                          onChange={(e) => setAgentSharePct(e.target.value)}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#d4af37' }}>%</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px', lineHeight: '1.4' }}>
                        ✅ Correct value: <strong>20</strong> (means agent pays 8,000 ETB cash for 10,000 ETB digital balance).
                      </p>
                    </div>
                  </div>

                  {/* Live preview block */}
                  <div style={{ background: '#faf9f7', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #e7e5e4' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', marginBottom: '16px' }}>Business Model Preview (Per 10k ETB Recharge)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #f5f5f4' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#78716c' }}>Agent pays in cash:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#d4af37' }}>{(10000 - (10000 * parseFloat(agentSharePct || '0') / 100)).toLocaleString()} ETB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #f5f5f4' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#78716c' }}>Admin credits wallet:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#22c55e' }}>10,000 ETB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #f5f5f4' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#78716c' }}>House edge deducted per game:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#3d2b1f' }}>Full {houseEdgeRate || '0'}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>Prize pool goes to players:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#059669' }}>{(100 - parseFloat(houseEdgeRate || '0')).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>



                  {settingsError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiAlertCircle /> {settingsError}
                    </div>
                  )}

                  {settingsSaved && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiCheckCircle /> Settings saved successfully! Changes are live immediately.
                    </div>
                  )}

                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="cmd-button"
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '14px' }}
                  >
                    {savingSettings ? 'SAVING...' : <><FiSave style={{ marginRight: '8px' }} /> SAVE ALL SETTINGS</>}
                  </button>
                </>
              )}
            </div>

            {/* Game Engine Mode */}
            <div className="stat-card-m" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiSettings style={{ color: '#d4af37' }} /> Game Engine Mode
                  </h2>
                  <p style={{ color: '#78716c', margin: '6px 0 0', fontSize: '13px' }}>
                    Switch between automated bots or wait for real players
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {settings.HOUSE_BOT_ENABLED ? (
                    <span style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '900' }}>🤖 AUTOMATED BOT MODE</span>
                  ) : (
                    <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '900' }}>👥 REAL PLAYERS ONLY</span>
                  )}
                </div>
              </div>

              <div style={{
                background: settings.HOUSE_BOT_ENABLED ? 'rgba(212, 175, 55, 0.04)' : 'rgba(34, 197, 94, 0.04)',
                border: `2px solid ${settings.HOUSE_BOT_ENABLED ? '#d4af37' : '#22c55e'}`,
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
              }}>
                <div>
                  <div style={{ fontWeight: '900', color: '#3d2b1f', fontSize: '16px' }}>
                    {settings.HOUSE_BOT_ENABLED ? 'House Bot Injection: ON' : 'House Bot Injection: OFF'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#78716c', marginTop: '6px', maxWidth: '380px', lineHeight: '1.5' }}>
                    {settings.HOUSE_BOT_ENABLED 
                      ? 'The game automatically injects 30 bots and starts immediately when 1 real player buys a ticket. Guarantees 60% house win rate.'
                      : 'The game waits in the Lobby until the minimum required real players (e.g. 2 players) buy tickets before starting the countdown.'}
                  </div>
                </div>
                <div
                  onClick={() => setSettings(s => ({ ...s, HOUSE_BOT_ENABLED: !s.HOUSE_BOT_ENABLED }))}
                  style={{
                    width: '56px', height: '30px',
                    background: settings.HOUSE_BOT_ENABLED ? '#d4af37' : '#e7e5e4',
                    borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px', background: 'white', borderRadius: '50%',
                    position: 'absolute', top: '4px', left: settings.HOUSE_BOT_ENABLED ? '30px' : '4px', transition: '0.3s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </div>
              </div>
            </div>

            {/* ─── Win Rate Control ─── */}
            <div className="stat-card-m" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🤖 Win Rate Control
                  </h2>
                  <p style={{ color: '#78716c', margin: '6px 0 0', fontSize: '13px' }}>Live house protection for Bingo.</p>
                </div>
                <button
                  onClick={handleSaveProtection}
                  disabled={savingProtection}
                  className="cmd-button"
                  style={{ padding: '9px 20px', borderRadius: '12px', fontSize: '13px' }}
                >
                  {savingProtection ? 'SAVING...' : 'SAVE'}
                </button>
              </div>

              {protectionSaved && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>
                  ✅ Win Rate settings saved! Live immediately.
                </div>
              )}

              {/* Bingo Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937', marginBottom: '6px' }}>🎰 Bingo Bot Protection Cycle</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                    {houseProtection.bingoWinRate === 10 ? '✅ 10/10 Cycle — Bots always win, real players cannot win.' :
                     houseProtection.bingoWinRate === 0  ? '🚨 0/10 Cycle — Fully random, no house bot injection.' :
                     `⚠️ ${houseProtection.bingoWinRate}/10 Cycle Active — real players can potentially win ${10 - houseProtection.bingoWinRate} game(s) every 10 games.`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <select
                    className="login-input"
                    style={{ width: '140px', padding: '10px 14px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', background: houseProtection.bingoWinRate === 10 ? '#dcfce7' : houseProtection.bingoWinRate === 0 ? '#fee2e2' : '#fff' }}
                    value={houseProtection.bingoWinRate}
                    onChange={(e) => {
                      const rate = parseInt(e.target.value);
                      setHouseProtection(s => ({ ...s, bingoWinRate: rate, forceHouseWin: rate === 10 }));
                    }}
                  >
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => (
                      <option key={n} value={n}>{n === 10 ? '10/10 (Always)' : n === 0 ? '0/10 (Never)' : `${n}/10 Cycle`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Slot Gamble Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937', marginBottom: '6px' }}>🎰 Buna Hot 5 Gamble House Edge</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                    Set the player's win chance for the double-or-nothing gamble. 
                    {houseProtection.slotGambleWinChance === 50 ? ' ⚖️ 50% (0% House Edge - high risk).' :
                     houseProtection.slotGambleWinChance === 5 ? ' 🛡️ 5% (90% House Edge - extreme protection).' :
                     ` 🛡️ ${houseProtection.slotGambleWinChance}% win chance (House Edge: ${100 - (houseProtection.slotGambleWinChance * 2)}%).`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <select
                    className="login-input"
                    style={{ width: '140px', padding: '10px 14px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', background: houseProtection.slotGambleWinChance <= 40 ? '#dcfce7' : '#fee2e2' }}
                    value={houseProtection.slotGambleWinChance}
                    onChange={(e) => {
                      const rate = parseInt(e.target.value);
                      setHouseProtection(s => ({ ...s, slotGambleWinChance: rate }));
                    }}
                  >
                    {[5, 10, 20, 30, 40, 45, 50].map(n => (
                      <option key={n} value={n}>{n}% Win Chance</option>
                    ))}
                  </select>
                </div>
              </div>


            </div>

            {/* Game Room Pricing */}
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#3d2b1f', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FiCoffee style={{ color: '#d4af37' }} /> Game Room Ticket Pricing
              </h2>

              {loadingRooms ? (
                <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '24px', border: '1px solid #f5f5f4' }}>
                  <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {rooms.filter(room => !room.type.startsWith('SPIN_')).map(room => (
                    <div key={room.id} className="stat-card-m" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="user-avatar" style={{ width: '46px', height: '46px', background: '#3d2b1f', color: '#d4af37', flexShrink: 0 }}>
                        <FiDollarSign size={18} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '900', color: '#3d2b1f', fontSize: '15px' }}>{room.type} Room</div>
                        <div style={{ fontSize: '12px', color: '#78716c' }}>Min Players: {room.minPlayers}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', fontSize: '11px', color: '#d4af37' }}>ETB</span>
                          <input
                            type="number"
                            className="login-input"
                            style={{ width: '110px', paddingLeft: '40px', fontWeight: '800' }}
                            defaultValue={parseFloat(room.ticketPrice)}
                            onBlur={(e) => {
                              const newPrice = parseFloat(e.target.value);
                              if (newPrice !== parseFloat(room.ticketPrice)) {
                                handleUpdateRoom(room.id, { ticketPrice: newPrice });
                              }
                            }}
                          />
                        </div>

                        <div
                          onClick={() => handleUpdateRoom(room.id, { isActive: !room.isActive })}
                          style={{
                            width: '48px', height: '26px',
                            background: room.isActive ? '#22c55e' : '#e7e5e4',
                            borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s'
                          }}
                        >
                          <div style={{
                            width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                            position: 'absolute', top: '4px', left: room.isActive ? '26px' : '4px', transition: '0.3s'
                          }} />
                        </div>

                        {savingRoom === room.id && (
                          <div className="animate-spin" style={{ width: '18px', height: '18px', border: '2px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Info Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="stat-card-m" style={{ background: '#3d2b1f', borderColor: '#3d2b1f', color: 'white' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiTrendingUp color="#d4af37" /> LIVE MARGIN SUMMARY
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Player Prize Pool', value: `${playerPrize}%`, color: '#22c55e' },
                  { label: 'Company Commission', value: `${houseEdgeRate}%`, color: '#f87171' },
                  { label: 'Recharge Discount', value: `${agentSharePct}%`, color: '#d4af37' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a8a29e', fontSize: '13px' }}>{label}</span>
                    <span style={{ fontWeight: '800', color, fontSize: '14px' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '20px', background: '#fffcf0', borderRadius: '20px', border: '1px solid #fef3c7', display: 'flex', gap: '12px' }}>
              <FiAlertCircle color="#d4af37" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontWeight: '600', lineHeight: '1.6' }}>
                Commission and payment changes are <b>live immediately</b> — no server restart needed. Ticket prices only affect new games, not games already in progress.
              </p>
            </div>

            <div className="stat-card-m">
              <h3 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 14px', color: '#3d2b1f' }}>SYSTEM STATUS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Game Engine', status: 'Optimized', color: '#22c55e' },
                  { label: 'Database', status: 'Healthy', color: '#22c55e' },
                  { label: 'Payment Webhook', status: 'Active', color: '#d4af37' },
                  { label: 'Dynamic Settings', status: 'Enabled', color: '#22c55e' },
                ].map(({ label, status, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{label}: <b>{status}</b></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BONUS TAB ═══════════════ */}
      {activeTab === 'bonus' && (
        <div style={{ maxWidth: '800px' }}>
          {/* Main Bonus Card */}
          <div className="stat-card-m" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#3d2b1f', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FiGift style={{ color: '#d4af37' }} /> Deposit Bonus Campaign
                </h2>
                <p style={{ color: '#78716c', margin: '6px 0 0', fontSize: '13px' }}>
                  Control the deposit match bonus for all players on the platform
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {bonusEffectivelyActive ? (
                  <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>🟢 LIVE</span>
                ) : bonusExpired ? (
                  <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>⏰ EXPIRED</span>
                ) : (
                  <span style={{ background: '#f5f5f4', color: '#78716c', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>⬚ OFF</span>
                )}
              </div>
            </div>

            {/* Master Toggle */}
            <div style={{
              background: bonusEffectivelyActive ? 'rgba(34, 197, 94, 0.04)' : '#faf9f7',
              border: `2px solid ${bonusEffectivelyActive ? '#22c55e' : '#e7e5e4'}`,
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}>
              <div>
                <div style={{ fontWeight: '900', color: '#3d2b1f', fontSize: '16px' }}>
                  {settings.BONUS_PERCENT || 100}% Deposit Match
                </div>
                <div style={{ fontSize: '13px', color: '#78716c', marginTop: '4px' }}>
                  Players receive {settings.BONUS_PERCENT || 100}% bonus on deposits of {settings.BONUS_MIN_DEPOSIT || 50} ETB or more
                </div>
                {bonusExpiry && (
                  <div style={{ fontSize: '12px', color: bonusExpired ? '#ef4444' : '#d4af37', marginTop: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiClock size={13} />
                    {bonusExpired
                      ? `Expired on ${bonusExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : `Expires: ${bonusExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    }
                  </div>
                )}
              </div>
              <div
                onClick={() => setSettings(s => ({ ...s, BONUS_ACTIVE: !s.BONUS_ACTIVE }))}
                style={{
                  width: '56px', height: '30px',
                  background: settings.BONUS_ACTIVE ? '#22c55e' : '#e7e5e4',
                  borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: '22px', height: '22px', background: 'white', borderRadius: '50%',
                  position: 'absolute', top: '4px', left: settings.BONUS_ACTIVE ? '30px' : '4px', transition: '0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </div>
            </div>

            {/* Configuration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bonus Percentage (%)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="1" max="500" step="5"
                    className="login-input"
                    style={{ width: '100%', paddingRight: '35px', fontWeight: '800', fontSize: '16px' }}
                    value={settings.BONUS_PERCENT}
                    onChange={(e) => setSettings(s => ({ ...s, BONUS_PERCENT: e.target.value }))}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#d4af37', fontSize: '14px' }}>%</span>
                </div>
                <p style={{ fontSize: '10px', color: '#a8a29e', marginTop: '4px' }}>e.g. 100 = double deposit</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Min Deposit (ETB)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0" step="10"
                    className="login-input"
                    style={{ width: '100%', paddingRight: '40px', fontWeight: '800', fontSize: '16px' }}
                    value={settings.BONUS_MIN_DEPOSIT}
                    onChange={(e) => setSettings(s => ({ ...s, BONUS_MIN_DEPOSIT: e.target.value }))}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#78716c', fontSize: '11px' }}>ETB</span>
                </div>
                <p style={{ fontSize: '10px', color: '#a8a29e', marginTop: '4px' }}>Minimum deposit to qualify</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Expiry Date/Time
                </label>
                <input
                  type="datetime-local"
                  className="login-input"
                  style={{ width: '100%', fontWeight: '700', fontSize: '13px' }}
                  value={settings.BONUS_EXPIRY ? settings.BONUS_EXPIRY.slice(0, 16) : ''}
                  onChange={(e) => setSettings(s => ({ ...s, BONUS_EXPIRY: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                />
                <p style={{ fontSize: '10px', color: '#a8a29e', marginTop: '4px' }}>Leave empty for no expiry</p>
              </div>
            </div>

            {/* Preview box */}
            <div style={{ background: 'linear-gradient(135deg, #faf9f7 0%, #f5f0e8 100%)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(212,175,55,0.2)', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                💡 PLAYER PREVIEW
              </div>
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e7e5e4' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#3d2b1f' }}>
                  🎁 Deposit {settings.BONUS_MIN_DEPOSIT || 50} ETB → Get {Math.round(Number(settings.BONUS_MIN_DEPOSIT || 50) * (1 + Number(settings.BONUS_PERCENT || 100) / 100))} ETB
                </div>
                <div style={{ fontSize: '12px', color: '#78716c', marginTop: '4px' }}>
                  {settings.BONUS_PERCENT || 100}% bonus applied instantly • Min {settings.BONUS_MIN_DEPOSIT || 50} ETB
                  {bonusExpiry && !bonusExpired && (
                    <span style={{ color: '#d4af37', fontWeight: '700' }}> • Ends {bonusExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </div>

            {settingsError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertCircle /> {settingsError}
              </div>
            )}

            {settingsSaved && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiCheckCircle /> Bonus settings saved! Changes are live immediately.
              </div>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="cmd-button"
              style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '14px' }}
            >
              {savingSettings ? 'SAVING...' : <><FiSave style={{ marginRight: '8px' }} /> SAVE BONUS SETTINGS</>}
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="stat-card-m" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => {
                setSettings(s => ({ ...s, BONUS_ACTIVE: true, BONUS_PERCENT: '100', BONUS_MIN_DEPOSIT: '50', BONUS_EXPIRY: '' }));
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                  <FiGift size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '13px' }}>100% Double Up</div>
                  <div style={{ fontSize: '11px', color: '#78716c' }}>Standard 100% match, no expiry</div>
                </div>
              </div>
            </div>

            <div className="stat-card-m" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 7);
                setSettings(s => ({ ...s, BONUS_ACTIVE: true, BONUS_PERCENT: '200', BONUS_MIN_DEPOSIT: '100', BONUS_EXPIRY: expiry.toISOString() }));
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
                  <FiClock size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '13px' }}>Flash 200% (7 days)</div>
                  <div style={{ fontSize: '11px', color: '#78716c' }}>Triple deposit, auto-expires in 7 days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ANNOUNCEMENTS TAB ═══════════════ */}
      {activeTab === 'promotions' && (
        <div style={{ maxWidth: '900px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>Announcements & Notifications</h2>
              <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '13px' }}>Create and broadcast messages to all platform users</p>
            </div>
            <button
              onClick={() => {
                setShowPromoForm(true);
                setEditingPromo(null);
                setPromoForm({ title: '', message: '', type: 'announcement', scheduledAt: '', expiresAt: '' });
                setImageFile(null);
                setImageUrl(null);
                setRemoveImage(false);
              }}
              className="cmd-button"
              style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiPlus size={16} /> New Announcement
            </button>
          </div>

          {/* Create/Edit Form Modal */}
          {showPromoForm && (
            <div className="stat-card-m" style={{ padding: '28px', marginBottom: '24px', border: '2px solid #d4af37' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>
                  {editingPromo ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>
                <button onClick={() => { setShowPromoForm(false); setEditingPromo(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716c' }}>
                  <FiX size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Title</label>
                  <input
                    type="text"
                    className="login-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Weekend Special Bonus!"
                    value={promoForm.title}
                    onChange={(e) => setPromoForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Message</label>
                  <textarea
                    className="login-input"
                    style={{ width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Write your announcement message here..."
                    value={promoForm.message}
                    onChange={(e) => setPromoForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Banner Image / Image (optional)</label>
                  {imageUrl && !removeImage ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: '#f5f5f4', borderRadius: '12px', marginBottom: '8px' }}>
                      <img 
                        src={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net'}${imageUrl}`} 
                        alt="Promo Banner" 
                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e7e5e4' }} 
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#3d2b1f', display: 'block' }}>Current image banner</span>
                        <button 
                          type="button" 
                          onClick={() => setRemoveImage(true)} 
                          style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : imageFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: '#f5f5f4', borderRadius: '12px', marginBottom: '8px' }}>
                      <img 
                        src={URL.createObjectURL(imageFile)} 
                        alt="Selected Preview" 
                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e7e5e4' }} 
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#3d2b1f', display: 'block', wordBreak: 'break-all' }}>{imageFile.name}</span>
                        <button 
                          type="button" 
                          onClick={() => setImageFile(null)} 
                          style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                        >
                          Clear File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', width: '100%', height: '100px', border: '2px dashed #e7e5e4', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setImageFile(e.target.files[0]);
                            setRemoveImage(false);
                          }
                        }}
                      />
                      <FiPlus size={20} style={{ color: '#d4af37', marginBottom: '6px' }} />
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#78716c' }}>Click to Upload Banner Image</span>
                      <span style={{ fontSize: '10px', color: '#a8a29e', marginTop: '2px' }}>PNG, JPG or JPEG (Max 5MB)</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Type</label>
                    <select
                      className="login-input"
                      style={{ width: '100%' }}
                      value={promoForm.type}
                      onChange={(e) => setPromoForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="announcement">📢 Announcement</option>
                      <option value="daily">📅 Daily</option>
                      <option value="weekly">📆 Weekly</option>
                      <option value="custom">🎯 Custom</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Schedule (optional)</label>
                    <input
                      type="datetime-local"
                      className="login-input"
                      style={{ width: '100%' }}
                      value={promoForm.scheduledAt}
                      onChange={(e) => setPromoForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#78716c', marginBottom: '6px', textTransform: 'uppercase' }}>Expires (optional)</label>
                    <input
                      type="datetime-local"
                      className="login-input"
                      style={{ width: '100%' }}
                      value={promoForm.expiresAt}
                      onChange={(e) => setPromoForm(f => ({ ...f, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button onClick={() => { setShowPromoForm(false); setEditingPromo(null); }} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e7e5e4', background: 'white', color: '#78716c', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                    Cancel
                  </button>
                  <button onClick={handleSavePromotion} disabled={savingPromo} className="cmd-button" style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '13px' }}>
                    {savingPromo ? 'Saving...' : (editingPromo ? 'Update' : 'Create Announcement')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Promotions List */}
          {loadingPromos ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
            </div>
          ) : promotions.length === 0 ? (
            <div className="stat-card-m" style={{ padding: '60px', textAlign: 'center' }}>
              <FiBell size={40} style={{ color: '#e7e5e4', margin: '0 auto 16px' }} />
              <p style={{ fontWeight: '800', color: '#3d2b1f', fontSize: '15px' }}>No announcements yet</p>
              <p style={{ color: '#78716c', fontSize: '13px' }}>Create your first announcement to engage with players</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {promotions.map(promo => {
                const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
                const typeEmoji = promo.type === 'daily' ? '📅' : promo.type === 'weekly' ? '📆' : promo.type === 'custom' ? '🎯' : '📢';

                return (
                  <div key={promo.id} className="stat-card-m" style={{
                    padding: '20px',
                    opacity: isExpired ? 0.6 : 1,
                    borderLeft: `4px solid ${promo.isActive && !isExpired ? '#22c55e' : isExpired ? '#ef4444' : '#e7e5e4'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '16px' }}>{typeEmoji}</span>
                          <span style={{ fontWeight: '900', color: '#3d2b1f', fontSize: '15px' }}>{promo.title}</span>
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: '800',
                            background: promo.isActive && !isExpired ? 'rgba(34,197,94,0.1)' : 'rgba(120,113,108,0.1)',
                            color: promo.isActive && !isExpired ? '#22c55e' : '#78716c',
                          }}>
                            {isExpired ? 'EXPIRED' : promo.isActive ? 'ACTIVE' : 'DRAFT'}
                          </span>
                          {promo.sentAt && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: '800', background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                              SENT
                            </span>
                          )}
                        </div>

                        {promo.imageUrl && (
                          <div style={{ marginTop: '4px', marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e7e5e4', maxWidth: '320px' }}>
                            <img 
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net'}${promo.imageUrl}`} 
                              alt="Announcement Banner" 
                              style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} 
                            />
                          </div>
                        )}

                        <p style={{ color: '#5c554b', fontSize: '13px', margin: '0 0 8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{promo.message}</p>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: '#a8a29e' }}>
                          <span>Created: {new Date(promo.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {promo.expiresAt && (
                            <span style={{ color: isExpired ? '#ef4444' : '#d4af37' }}>
                              Expires: {new Date(promo.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {promo.sentAt && (
                            <span style={{ color: '#3b82f6' }}>
                              Sent: {new Date(promo.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {/* Toggle */}
                        <button
                          onClick={() => handleTogglePromo(promo)}
                          title={promo.isActive ? 'Deactivate' : 'Activate'}
                          style={{
                            width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e7e5e4',
                            background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: promo.isActive ? '#22c55e' : '#a8a29e',
                          }}
                        >
                          {promo.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditingPromo(promo);
                            setPromoForm({
                              title: promo.title,
                              message: promo.message,
                              type: promo.type,
                              scheduledAt: promo.scheduledAt ? promo.scheduledAt.slice(0, 16) : '',
                              expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 16) : '',
                            });
                            setImageUrl(promo.imageUrl || null);
                            setImageFile(null);
                            setRemoveImage(false);
                            setShowPromoForm(true);
                          }}
                          title="Edit"
                          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e7e5e4', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}
                        >
                          <FiEdit2 size={14} />
                        </button>

                        {/* Broadcast */}
                        <button
                          onClick={() => handleBroadcast(promo.id)}
                          disabled={broadcastingId === promo.id}
                          title="Broadcast to all users"
                          style={{
                            width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e7e5e4',
                            background: broadcastingId === promo.id ? '#f5f5f4' : 'white',
                            cursor: broadcastingId === promo.id ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37',
                          }}
                        >
                          {broadcastingId === promo.id
                            ? <div className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%' }} />
                            : <FiSend size={14} />
                          }
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeletePromo(promo.id)}
                          title="Delete"
                          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #fecaca', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Application Modal (replaces alert and confirm) */}
      {appModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s ease-out forwards' }}>
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: appModal.isError ? '#ef4444' : '#3d2b1f', marginBottom: '12px' }}>
                {appModal.title}
              </h3>
              <p style={{ fontSize: '15px', color: '#5c554b', lineHeight: '1.5', marginBottom: '32px' }}>
                {appModal.message}
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                {appModal.type === 'confirm' && (
                  <button
                    onClick={() => setAppModal(prev => ({ ...prev, isOpen: false }))}
                    style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#78716c', background: '#f5f5f4', border: 'none', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    if (appModal.type === 'confirm' && appModal.onConfirm) {
                      appModal.onConfirm();
                    } else {
                      setAppModal(prev => ({ ...prev, isOpen: false }));
                    }
                  }}
                  style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', color: '#fff', background: appModal.type === 'confirm' ? '#3b82f6' : '#d4af37', border: 'none', cursor: 'pointer' }}
                >
                  {appModal.type === 'confirm' ? 'Confirm' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
