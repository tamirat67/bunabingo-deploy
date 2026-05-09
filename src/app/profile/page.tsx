'use client';
import { useEffect, useState } from 'react';
import { getProfile } from '../../lib/api';
import { Check, Volume2, Moon, Users, ChevronRight, Wallet, Coins, Trophy } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getProfile().then(setProfile).catch(() => {});
  }, []);

  if (!mounted) return null;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="avatar-circle">
          <Check size={40} color="white" strokeWidth={4} />
        </div>
        <h1 className="user-name">{profile?.username || 'User'} 🦅</h1>
      </div>

      <div className="profile-stats-grid">
        <div className="stat-card">
          <Wallet size={24} color="#D4AF37" className="stat-icon" />
          <div className="label">Balance</div>
          <div className="value">{Number(profile?.balance ?? 0).toFixed(0)} Birr</div>
        </div>
        <div className="stat-card">
          <Wallet size={24} color="#D4AF37" className="stat-icon" />
          <div className="label">Bonus Wallet</div>
          <div className="value">{Number(profile?.bonusBalance ?? 0).toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <Coins size={24} color="#D4AF37" className="stat-icon" />
          <div className="label">Total Coins</div>
          <div className="value">{Number(profile?.totalCoins ?? 0).toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <Trophy size={24} color="#D4AF37" className="stat-icon" />
          <div className="label">Games Won</div>
          <div className="value">{profile?.gamesWon ?? 0}</div>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-title">Settings</h2>
        
        <div className="settings-row">
          <div className="row-left">
            <Volume2 size={20} />
            <span>Sound</span>
          </div>
          <div className="toggle-bg on"><div className="toggle-circle"></div></div>
        </div>

        <div className="settings-row">
          <div className="row-left">
            <Moon size={20} />
            <span>Dark Mode</span>
          </div>
          <div className="toggle-bg"><div className="toggle-circle"></div></div>
        </div>

        <div className="settings-row">
          <div className="row-left">
            <Users size={20} />
            <span>Invite Friends</span>
          </div>
          <div className="row-right">
            <span className="share-text">Share</span>
            <ChevronRight size={16} opacity={0.5} />
          </div>
        </div>
      </div>

      <div className="copyright-footer">© Buna Bingo</div>
    </div>
  );
}
