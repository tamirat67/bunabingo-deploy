"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLock, FiPhone, FiEye, FiEyeOff, FiShield, FiArrowRight } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;

      localStorage.setItem('admin_token', token);
      
      if (user.role === 'ADMIN' || user.isAdmin) {
        router.push('/admin');
      } else if (user.role === 'STAFF') {
        router.push('/admin/staff-dashboard');
      } else {
        router.push('/agent');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Access Denied. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cmd-body" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="cmd-login-card" style={{ position: 'relative', zIndex: 10 }}>
        {/* Brand Corner Stripes (Footer Part) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: '0 0 32px 32px' }}>
          
          {/* Bottom Left - Blue */}
          <div style={{ position: 'absolute', bottom: '10px', left: '-80px', width: '250px', transform: 'rotate(45deg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '24px', backgroundColor: '#00AEEF' }} />
          </div>

          {/* Bottom Right - Brand Colors */}
          <div style={{ position: 'absolute', bottom: '10px', right: '-80px', width: '250px', transform: 'rotate(-45deg)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ height: '12px', backgroundColor: '#dc2626' }} /> 
            <div style={{ height: '12px', backgroundColor: '#16a34a' }} /> 
            <div style={{ height: '12px', backgroundColor: '#eab308' }} /> 
          </div>
        </div>
        {/* Logo */}
        <div className="cmd-logo-wrapper">
          <img src="/logo.png" alt="Buna Bingo Brand" className="cmd-logo-img" style={{ borderRadius: '50%' }} />
        </div>

        {/* Title Section */}
        <h1 className="cmd-title">
          <span className="buna">BUNA</span> <span className="bingo">BINGO</span>
        </h1>
        <p className="cmd-subtitle">The Command Center</p>

        {/* Form */}
        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '20px', fontWeight: '700' }}>
               {error}
            </div>
          )}

          <div className="cmd-input-group">
            <label className="cmd-label">
              <FiPhone /> Telegram ID / Username
            </label>
            <div className="cmd-input-container">
              <input 
                type="text"
                required
                placeholder="Enter your telegram ID or username"
                className="cmd-input gold-border"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="cmd-input-group">
            <label className="cmd-label">
              <FiLock /> Security PIN
            </label>
            <div className="cmd-input-container">
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••"
                className="cmd-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div 
                className="cmd-input-eye"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="cmd-button"
          >
            {loading ? 'AUTHORIZING...' : (
              <>
                ENTER PORTAL <FiArrowRight />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="cmd-footer">
          <div className="cmd-encrypted">
            <FiShield size={14} /> End-to-end encrypted session
          </div>
          <div className="cmd-dots">
            <div className="cmd-dot"></div>
            <div className="cmd-dot active"></div>
            <div className="cmd-dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
