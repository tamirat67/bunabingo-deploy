"use client";

import React, { useEffect, useState } from 'react';
import { FiUser, FiShield, FiLogOut } from 'react-icons/fi';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await api.get('/me');
        setUser(response.data);
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
    router.push('/admin/login');
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
        <p className="agent-subtitle">Manage your agent profile and account security.</p>
      </div>

      <div className="agent-settings-grid">

        {/* Left: Profile Card */}
        <div className="agent-space-y-6">
          <div className="agent-card-3xl">
            <div className="agent-gold-stripe" />
            <div className="agent-profile-avatar">
              {(user.firstName || 'U')[0]}
            </div>
            <h2 className="agent-h2">{user.firstName} {user.lastName}</h2>
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
              <FiUser style={{ color:'var(--agent-gold)' }} /> PERSONAL INFORMATION
            </h3>
            <div className="agent-space-y-6">
              <div className="agent-grid-2eq">
                <div>
                  <label className="agent-field-label">First Name</label>
                  <div className="agent-field-value">{user.firstName}</div>
                </div>
                <div>
                  <label className="agent-field-label">Last Name</label>
                  <div className="agent-field-value">{user.lastName}</div>
                </div>
              </div>
              <div>
                <label className="agent-field-label">Phone Number</label>
                <div className="agent-field-value">
                  {user.phoneNumber}
                  <span className="agent-verified-tag">VERIFIED</span>
                </div>
              </div>
            </div>
          </div>

          <div className="agent-card-gold-sm">
            <div style={{ padding:'0.5rem', background:'rgba(212,175,55,0.2)', borderRadius:'0.5rem', color:'var(--agent-gold)', flexShrink:0 }}>
              <FiShield size={20} />
            </div>
            <div>
              <h4 className="agent-text-gold" style={{ fontWeight:700, fontSize:'0.875rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                Agent Verification
              </h4>
              <p className="agent-text-muted2 agent-mt-1" style={{ fontSize:'0.75rem', lineHeight:1.6 }}>
                Your account is fully verified. You have access to all referral and withdrawal processing features.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
