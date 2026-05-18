"use client";

import React, { useEffect, useState } from 'react';
import {
  FiSettings, FiDollarSign, FiPhone, FiUser, FiSave,
  FiAlertCircle, FiCoffee, FiTrendingUp, FiPercent, FiCheckCircle, FiEdit2
} from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

interface SystemSettings {
  COMPANY_COMMISSION_RATE: string;
  AGENT_PROFIT_RATE: string;
  PAYMENT_RECEIVER_PHONE: string;
  PAYMENT_RECEIVER_NAME: string;
  PAYMENT_TELEBIRR_PHONE: string;
}

export default function SettingsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [savingRoom, setSavingRoom] = useState<string | null>(null);

  const [settings, setSettings] = useState<SystemSettings>({
    COMPANY_COMMISSION_RATE: '12.5',
    AGENT_PROFIT_RATE: '12.5',
    PAYMENT_RECEIVER_PHONE: '',
    PAYMENT_RECEIVER_NAME: '',
    PAYMENT_TELEBIRR_PHONE: '',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    fetchRooms();
    fetchSettings();
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
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoadingSettings(false);
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

  const totalHouseMargin = (
    parseFloat(settings.COMPANY_COMMISSION_RATE || '0') +
    parseFloat(settings.AGENT_PROFIT_RATE || '0')
  ).toFixed(2);

  const playerPrize = (
    100 - parseFloat(totalHouseMargin)
  ).toFixed(2);

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>System Control</h1>
        <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>
          Fine-tune your platform's financial rules and payment settings
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

          {/* ── Commission Rates Section ── */}
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
                  {/* Company Commission */}
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

                  {/* Agent Profit */}
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

                {/* ── Payment Phone Numbers ── */}
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#3d2b1f', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FiPhone style={{ color: '#d4af37' }} /> Deposit Payment Details
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase' }}>
                        <FiUser size={11} style={{ marginRight: '4px' }} /> Receiver Name (MPESA/CBE)
                      </label>
                      <input
                        type="text"
                        className="login-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Buna Bingo"
                        value={settings.PAYMENT_RECEIVER_NAME}
                        onChange={(e) => setSettings(s => ({ ...s, PAYMENT_RECEIVER_NAME: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase' }}>
                        <FiPhone size={11} style={{ marginRight: '4px' }} /> Receiver Phone (MPESA/CBE)
                      </label>
                      <input
                        type="text"
                        className="login-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 0912345678"
                        value={settings.PAYMENT_RECEIVER_PHONE}
                        onChange={(e) => setSettings(s => ({ ...s, PAYMENT_RECEIVER_PHONE: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#78716c', marginBottom: '8px', textTransform: 'uppercase' }}>
                      <FiPhone size={11} style={{ marginRight: '4px' }} /> Telebirr Receiving Phone
                    </label>
                    <input
                      type="text"
                      className="login-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. 0997688294"
                      value={settings.PAYMENT_TELEBIRR_PHONE}
                      onChange={(e) => setSettings(s => ({ ...s, PAYMENT_TELEBIRR_PHONE: e.target.value }))}
                    />
                    <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px' }}>
                      This number is shown to players for Telebirr deposits and used for SMS validation
                    </p>
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

          {/* ── Game Room Pricing ── */}
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
    </div>
  );
}
