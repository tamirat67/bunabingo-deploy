"use client";

import React, { useEffect, useState } from 'react';
import { FiUser, FiShield, FiLogOut, FiPhone, FiSave, FiPlus, FiTrash2, FiMessageCircle } from 'react-icons/fi';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    telegramUsername: '',
  });

  const [depositPhones, setDepositPhones] = useState<{name: string, phone: string, last4: string}[]>([]);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await api.get('/me');
        const userData = response.data;
        setUser(userData);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          telegramUsername: userData.telegramUsername || '',
        });
        
        let phones = [];
        if (Array.isArray(userData.depositPhones)) {
          phones = [...userData.depositPhones];
        } else if (typeof userData.depositPhones === 'string') {
          try {
            phones = JSON.parse(userData.depositPhones);
          } catch (e) {}
        }
        if (phones.length === 0) phones = [{ name: '', phone: '', last4: '' }];
        setDepositPhones(phones);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
      (window as any).Telegram.WebApp.close();
    } else {
      router.push('/admin/login');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.patch('/agent/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        telegramUsername: formData.telegramUsername,
        depositPhones: depositPhones.filter(p => p.phone.trim() !== '')
      });
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return (
    <div className="agent-space-y-6">
      <div className="agent-skeleton" style={{ height: '2.5rem', width: '25%', borderRadius: '0.5rem' }} />
      <div className="agent-skeleton" style={{ height: '16rem', borderRadius: '1rem' }} />
      <div className="agent-skeleton" style={{ height: '8rem', borderRadius: '1rem' }} />
    </div>
  );

  return (
    <div className="agent-max-w agent-space-y-10">

      <div>
        <h1 className="agent-h1">Settings</h1>
        <p className="agent-subtitle">Manage your agent profile, support contact, and deposit methods.</p>
      </div>

      {successMsg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', color: '#22c55e', padding: '12px 16px', borderRadius: '8px', fontWeight: 'bold' }}>{successMsg}</div>}
      {errorMsg && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontWeight: 'bold' }}>{errorMsg}</div>}

      <div className="agent-settings-grid">

        {/* Left: Profile Card */}
        <div className="agent-space-y-6">
          <div className="agent-card-3xl">
            <div className="agent-gold-stripe" />
            <div className="agent-profile-avatar">
              {(formData.firstName || 'U')[0]}
            </div>
            <h2 className="agent-h2">{formData.firstName} {formData.lastName}</h2>
            <p className="agent-text-gold agent-mt-1" style={{ fontSize:'0.75rem', fontWeight:900, letterSpacing:'0.15em', textTransform:'uppercase' }}>
              Official Agent
            </p>
            <hr className="agent-divider" />
            <div className="agent-space-y-6">
              <div className="agent-info-row">
                <span className="agent-text-muted2" style={{ fontWeight:700, fontSize:'0.875rem' }}>Role</span>
                <span className="agent-text-white" style={{ fontWeight:900, fontSize:'0.875rem' }}>{user.role}</span>
              </div>
              <div className="agent-info-row">
                <span className="agent-text-muted2" style={{ fontWeight:700, fontSize:'0.875rem' }}>Status</span>
                <span className="agent-text-green" style={{ fontWeight:900, fontSize:'0.875rem' }}>ACTIVE</span>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="agent-btn-danger">
            <FiLogOut /> LOGOUT SESSION
          </button>
        </div>

        {/* Right: Detail Settings */}
        <div className="agent-space-y-6">
          <div className="agent-card-lg">
            <h3 className="agent-h3" style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'2rem' }}>
              <FiUser style={{ color:'var(--agent-gold)' }} /> PUBLIC PROFILE & SUPPORT
            </h3>
            
            <p className="agent-subtitle" style={{ marginBottom: '1rem', fontSize: '13px' }}>This information is shown to players in your branch when they need to contact you for support.</p>
            
            <div className="agent-space-y-6">
              <div className="agent-grid-2eq">
                <div>
                  <label className="agent-field-label">First Name</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '8px' }}
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="agent-field-label">Last Name</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '8px' }}
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="agent-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiMessageCircle /> Telegram Support Username
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. agent_john"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '8px' }}
                  value={formData.telegramUsername}
                  onChange={(e) => setFormData({...formData, telegramUsername: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="agent-card-lg">
            <h3 className="agent-h3" style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'2rem' }}>
              <FiPhone style={{ color:'var(--agent-gold)' }} /> DEPOSIT METHODS
            </h3>
            <p className="agent-subtitle" style={{ marginBottom: '1.5rem', fontSize: '13px' }}>Players will see these accounts when they attempt to deposit into their wallet.</p>
            
            <div className="agent-space-y-4">
              {depositPhones.map((phoneEntry, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px 40px', gap: '8px', alignItems: 'end', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--agent-muted)', display: 'block', marginBottom: '4px' }}>Account Name</label>
                    <input type="text" placeholder="e.g. JOHN DOE" value={phoneEntry.name} onChange={e => {
                      const newPhones = [...depositPhones];
                      newPhones[index].name = e.target.value;
                      setDepositPhones(newPhones);
                    }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px', fontSize: '13px', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--agent-muted)', display: 'block', marginBottom: '4px' }}>Phone Number (Telebirr/CBE)</label>
                    <input type="text" placeholder="e.g. 251911..." value={phoneEntry.phone} onChange={e => {
                      const val = e.target.value;
                      const newPhones = [...depositPhones];
                      newPhones[index] = {
                        ...newPhones[index],
                        phone: val,
                        last4: val.length >= 4 ? val.slice(-4) : val
                      };
                      setDepositPhones(newPhones);
                    }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px', fontSize: '13px', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--agent-muted)', display: 'block', marginBottom: '4px' }}>Last 4</label>
                    <input type="text" value={phoneEntry.last4} readOnly style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', color: 'var(--agent-muted)', border: '1px solid transparent', borderRadius: '6px' }} />
                  </div>
                  <button onClick={() => {
                    const newPhones = depositPhones.filter((_, i) => i !== index);
                    setDepositPhones(newPhones);
                  }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '6px', cursor: 'pointer', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiTrash2 />
                  </button>
                </div>
              ))}

              <button onClick={() => setDepositPhones([...depositPhones, { name: '', phone: '', last4: '' }])} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px dashed rgba(34,197,94,0.3)', width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <FiPlus /> Add Phone Number
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleSaveProfile} 
            disabled={saving}
            className="agent-btn-gold" 
            style={{ width: '100%', padding: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {saving ? 'SAVING...' : <><FiSave size={18} /> SAVE ALL CHANGES</>}
          </button>
          
          <div className="agent-card-gold-sm" style={{ marginTop: '24px' }}>
            <div style={{ padding:'0.5rem', background:'rgba(212,175,55,0.2)', borderRadius:'0.5rem', color:'var(--agent-gold)', flexShrink:0 }}>
              <FiShield size={20} />
            </div>
            <div>
              <h4 className="agent-text-gold" style={{ fontWeight:700, fontSize:'0.875rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                Security & Verification
              </h4>
              <p className="agent-text-muted2 agent-mt-1" style={{ fontSize:'0.75rem', lineHeight:1.6 }}>
                Your account is fully verified. To change your login password or phone number, please contact the System Administrator.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
