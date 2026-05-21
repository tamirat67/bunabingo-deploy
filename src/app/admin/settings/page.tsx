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
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

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

  useEffect(() => {
    fetchRooms();
    fetchSettings();
    fetchPromotions();
  }, []);

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
      });
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
      alert('Update failed.');
    } finally {
      setSavingRoom(null);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsError('');
    const compRate = parseFloat(settings.COMPANY_COMMISSION_RATE);
    const agentRate = parseFloat(settings.AGENT_PROFIT_RATE);

    if (isNaN(compRate) || compRate < 0 || compRate > 50) {
      setSettingsError('Company commission must be between 0% and 50%.');
      return;
    }
    if (isNaN(agentRate) || agentRate < 0 || agentRate > 50) {
      setSettingsError('Agent profit rate must be between 0% and 50%.');
      return;
    }
    if (compRate + agentRate > 25) {
      setSettingsError(`Total house margin (${(compRate + agentRate).toFixed(2)}%) cannot exceed 25%. Lower one of the rates.`);
      return;
    }

    setSavingSettings(true);
    try {
      await api.put('/admin/settings', settings);
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
      alert('Title and message are required.');
      return;
    }
    setSavingPromo(true);
    try {
      const formData = new FormData();
      formData.append('title', promoForm.title);
      formData.append('message', promoForm.message);
      formData.append('type', promoForm.type);
      formData.append('scheduledAt', promoForm.scheduledAt || '');
      formData.append('expiresAt', promoForm.expiresAt || '');
      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editingPromo) {
        if (removeImage) {
          formData.append('removeImage', 'true');
        }
        await api.patch(`/admin/promotions/${editingPromo.id}`, formData);
      } else {
        await api.post('/admin/promotions', formData);
      }
      setShowPromoForm(false);
      setEditingPromo(null);
      setImageFile(null);
      setImageUrl(null);
      setRemoveImage(false);
      setPromoForm({ title: '', message: '', type: 'announcement', scheduledAt: '', expiresAt: '' });
      fetchPromotions();
    } catch (err) {
      alert('Failed to save promotion.');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Delete this promotion? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/promotions/${id}`);
      fetchPromotions();
    } catch (err) {
      alert('Failed to delete promotion.');
    }
  };

  const handleTogglePromo = async (promo: Promotion) => {
    try {
      await api.patch(`/admin/promotions/${promo.id}`, { isActive: !promo.isActive });
      fetchPromotions();
    } catch (err) {
      alert('Failed to toggle promotion.');
    }
  };

  const handleBroadcast = async (id: string) => {
    if (!window.confirm('Broadcast this message to ALL users? This action cannot be undone.')) return;
    setBroadcastingId(id);
    try {
      const res = await api.post(`/admin/promotions/${id}/broadcast`);
      alert(`Broadcast queued to ${res.data.totalRecipients} users!`);
      fetchPromotions();
    } catch (err) {
      alert('Failed to broadcast.');
    } finally {
      setBroadcastingId(null);
    }
  };

  const totalHouseMargin = (
    parseFloat(settings.COMPANY_COMMISSION_RATE || '0') +
    parseFloat(settings.AGENT_PROFIT_RATE || '0')
  ).toFixed(2);

  const playerPrize = (
    100 - parseFloat(totalHouseMargin)
  ).toFixed(2);

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

              {loadingSettings ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🏢 Company Commission (%)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min="0" max="50" step="0.5"
                          className="login-input"
                          style={{ width: '100%', paddingRight: '40px' }}
                          value={settings.COMPANY_COMMISSION_RATE}
                          onChange={(e) => setSettings(s => ({ ...s, COMPANY_COMMISSION_RATE: e.target.value }))}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#d4af37' }}>%</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px' }}>Deducted from agent pre-deposit per game</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        👤 Agent Profit Rate (%)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min="0" max="50" step="0.5"
                          className="login-input"
                          style={{ width: '100%', paddingRight: '40px' }}
                          value={settings.AGENT_PROFIT_RATE}
                          onChange={(e) => setSettings(s => ({ ...s, AGENT_PROFIT_RATE: e.target.value }))}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#d4af37' }}>%</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px' }}>Retained by agent as net take-home</p>
                    </div>
                  </div>

                  {/* Live preview bar */}
                  <div style={{ background: '#faf9f7', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #e7e5e4' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', marginBottom: '12px' }}>Revenue Split Preview (per 100 ETB ticket sales)</p>
                    <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ width: `${playerPrize}%`, background: '#22c55e' }} title={`Player Prize: ${playerPrize}%`} />
                      <div style={{ width: `${settings.AGENT_PROFIT_RATE}%`, background: '#d4af37' }} title={`Agent: ${settings.AGENT_PROFIT_RATE}%`} />
                      <div style={{ width: `${settings.COMPANY_COMMISSION_RATE}%`, background: '#3d2b1f' }} title={`Company: ${settings.COMPANY_COMMISSION_RATE}%`} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} />
                        Player Prize: {playerPrize} ETB
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#d4af37', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#d4af37', display: 'inline-block' }} />
                        Agent: {settings.AGENT_PROFIT_RATE} ETB
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#3d2b1f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3d2b1f', display: 'inline-block' }} />
                        Company: {settings.COMPANY_COMMISSION_RATE} ETB
                      </span>
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
                  {rooms.map(room => (
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
                  { label: 'Agent Take-Home', value: `${settings.AGENT_PROFIT_RATE}%`, color: '#d4af37' },
                  { label: 'Company Commission', value: `${settings.COMPANY_COMMISSION_RATE}%`, color: '#f87171' },
                  { label: 'Total House Margin', value: `${totalHouseMargin}%`, color: '#a78bfa' },
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
    </div>
  );
}
