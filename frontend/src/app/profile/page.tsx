'use client';
import { useEffect, useState } from 'react';
import { getProfile } from '../../lib/api';
import Navbar from '../../components/Navbar';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="profile-container">
      {/* ─── Profile Header ────────────────────────────────── */}
      <div className="profile-header">
        <div className="avatar-wrap">
          <div className="avatar-main">✅</div>
        </div>
        <h2 className="username">{profile?.username || 'User'} 🦅</h2>
      </div>

      {/* ─── Stats Grid (2x2) ─────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">👛</span>
          <div className="stat-label">Balance</div>
          <div className="stat-val">{Number(profile?.balance || 0).toFixed(0)} Birr</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎗️</span>
          <div className="stat-label">Bonus Wallet</div>
          <div className="stat-val">{Number(profile?.bonusBalance || 0).toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🪙</span>
          <div className="stat-label">Total Coins</div>
          <div className="stat-val">{Number(profile?.totalCoins || 0).toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏆</span>
          <div className="stat-label">Games Won</div>
          <div className="stat-val">{profile?.gamesWon || 0}</div>
        </div>
      </div>

      {/* ─── Settings List ────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="section-title">Settings</h3>
        
        <div className="settings-list">
          <div className="setting-item">
            <div className="setting-info">
              <span className="icon">🔊</span>
              <span>Sound</span>
            </div>
            <div className="toggle off"></div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="icon">🌙</span>
              <span>Dark Mode</span>
            </div>
            <div className="toggle off"></div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="icon">👥</span>
              <span>Invite Friends</span>
            </div>
            <div className="share-link">Share &gt;</div>
          </div>
        </div>
      </div>

      <div className="footer-brand">© Buna Bingo</div>

      <Navbar />

      <style jsx>{`
        .profile-container { min-height: 100vh; background: #a68cc5; padding: 24px 16px 100px; color: white; }
        
        .profile-header { text-align: center; margin-bottom: 24px; }
        .avatar-wrap { 
          width: 100px; height: 100px; background: #4ade80; border-radius: 50%; 
          margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;
          border: 4px solid rgba(255,255,255,0.2); font-size: 50px;
        }
        .username { font-size: 20px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }

        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px; }
        .stat-card {
          background: rgba(255,255,255,0.15); border-radius: 16px; padding: 16px;
          text-align: center; display: flex; flex-direction: column; align-items: center;
        }
        .stat-icon { font-size: 24px; margin-bottom: 8px; }
        .stat-label { font-size: 11px; font-weight: 600; opacity: 0.8; margin-bottom: 4px; }
        .stat-val { font-size: 16px; font-weight: 800; }

        .settings-section { margin-bottom: 40px; }
        .section-title { font-size: 18px; font-weight: 800; margin-bottom: 16px; padding-left: 4px; }
        
        .settings-list { background: rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; }
        .setting-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .setting-item:last-child { border-bottom: none; }
        .setting-info { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; }
        .setting-info .icon { font-size: 18px; opacity: 0.8; }

        .toggle { width: 34px; height: 18px; background: rgba(255,255,255,0.2); border-radius: 99px; position: relative; }
        .toggle.off::after { 
          content: ''; position: absolute; left: 2px; top: 2px; 
          width: 14px; height: 14px; background: white; border-radius: 50%; opacity: 0.5;
        }
        
        .share-link { font-size: 13px; font-weight: 700; opacity: 0.6; }

        .footer-brand { text-align: center; font-size: 12px; opacity: 0.4; font-weight: 600; }
      `}</style>
    </div>
  );
}
