"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLock, FiUser, FiAward, FiAlertCircle } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

      // Save token
      localStorage.setItem('admin_token', token);
      
      // Redirect based on role
      if (user.role === 'ADMIN' || user.isAdmin) {
        router.push('/admin');
      } else {
        router.push('/agent');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo Section */}
        <div className="login-header">
          <div className="login-logo">
            <FiAward />
          </div>
          <h1 style={{fontSize: '32px', fontWeight: '900', letterSpacing: '-1px'}}>BUNA BINGO</h1>
          <p style={{color: 'var(--admin-text-muted)', marginTop: '8px'}}>Management Portal Access</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {error && (
            <div className="login-error">
              <FiAlertCircle style={{marginTop: '2px', flexShrink: 0}} />
              <p>{error}</p>
            </div>
          )}

          <div className="login-input-group">
            <label className="login-label">Telegram ID / Username</label>
            <div className="login-input-wrapper">
              <FiUser className="login-input-icon" />
              <input 
                type="text"
                required
                placeholder="Enter your ID or @username"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-label">Secure Password</label>
            <div className="login-input-wrapper">
              <FiLock className="login-input-icon" />
              <input 
                type="password"
                required
                placeholder="••••••••"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? 'AUTHENTICATING...' : 'ENTER DASHBOARD'}
          </button>
        </form>

        <div style={{textAlign: 'center', marginTop: '32px'}}>
           <p style={{fontSize: '12px', color: 'var(--admin-text-muted)', lineHeight: '1.6'}}>
             Forgot your password? <br/> Contact the Super Admin via the bot.
           </p>
        </div>
      </div>
    </div>
  );
}
