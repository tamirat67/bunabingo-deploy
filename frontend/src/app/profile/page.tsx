'use client';
import { useEffect, useState } from 'react';
import { getWallet, updateProfile } from '../lib/api';
import { initTelegram, getTgUser } from '../lib/telegram';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { User, Phone, Settings, Volume2, VolumeX, Moon, Sun, Save, ChevronRight } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', phoneNumber: '' });
  
  // Settings State
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<'gold' | 'dark'>('gold');
  
  const { show } = useToast();

  useEffect(() => {
    initTelegram();
    const tgUser = getTgUser();
    
    // Load persisted settings
    const savedSound = localStorage.getItem('buna-sound') !== 'off';
    const savedTheme = (localStorage.getItem('buna-theme') as any) || 'gold';
    setSoundOn(savedSound);
    setTheme(savedTheme);

    Promise.all([getWallet()])
      .then(([w]) => {
        setWallet(w);
        setUser(w.user);
        setFormData({ firstName: w.user.firstName || '', phoneNumber: w.user.phoneNumber || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSound = () => {
    const newVal = !soundOn;
    setSoundOn(newVal);
    localStorage.setItem('buna-sound', newVal ? 'on' : 'off');
    show(newVal ? 'Sound Enabled 🔊' : 'Sound Muted 🔇', 'info');
  };

  const toggleTheme = () => {
    const newVal = theme === 'gold' ? 'dark' : 'gold';
    setTheme(newVal);
    localStorage.setItem('buna-theme', newVal);
    show(`Theme set to ${newVal === 'gold' ? 'Light Gold' : 'Dark Gray'}`, 'info');
    // Global class update for CSS
    document.body.className = newVal === 'dark' ? 'theme-dark' : '';
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setUser({ ...user, ...formData });
      setIsEditing(false);
      show('Profile updated successfully! ✅', 'success');
    } catch (err) {
      show('Failed to update profile', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>LOADING PROFILE...</span></div>;

  return (
    <div className={`profile-container ${theme}`}>
      <div className="profile-header">
        <div className="avatar-box">
          <div className="avatar-circle">
            <User size={48} color={theme === 'dark' ? '#c9d1d9' : '#4B3621'} />
          </div>
          <h2 className="user-name">{user?.firstName || 'Buna Player'}</h2>
          <p className="user-id">PLAYER-ID: #{user?.id?.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title"><Settings size={18} /> Account Details</h3>
        <div className="input-group">
          <div className="input-row">
            <User size={18} className="icon" />
            <div className="input-wrap">
              <label>Full Name</label>
              {isEditing ? (
                <input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              ) : (
                <span>{user?.firstName}</span>
              )}
            </div>
          </div>
          <div className="input-row">
            <Phone size={18} className="icon" />
            <div className="input-wrap">
              <label>Phone Number</label>
              {isEditing ? (
                <input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
              ) : (
                <span>{user?.phoneNumber || 'Not Linked'}</span>
              )}
            </div>
          </div>
          
          <button className="btn-action" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
            {isEditing ? <><Save size={18} /> Save Changes</> : 'Edit Profile'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title"><Settings size={18} /> Game Settings</h3>
        
        <div className="setting-toggle-row" onClick={toggleSound}>
          <div className="toggle-left">
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            <div className="toggle-info">
              <div className="title">Game Announcer</div>
              <div className="desc">Voice calling numbers (1-100)</div>
            </div>
          </div>
          <div className={`toggle-switch ${soundOn ? 'on' : ''}`}></div>
        </div>

        <div className="setting-toggle-row" onClick={toggleTheme}>
          <div className="toggle-left">
            {theme === 'gold' ? <Sun size={20} /> : <Moon size={20} />}
            <div className="toggle-info">
              <div className="title">Display Mode</div>
              <div className="desc">{theme === 'gold' ? 'Light Golden (Premium)' : 'Dark Gray (GitHub)'}</div>
            </div>
          </div>
          <div className="toggle-btn-mini">Switch</div>
        </div>
      </div>

      <div className="stats-mini-row">
        <div className="mini-card">
          <div className="l">Total Games</div>
          <div className="v">0</div>
        </div>
        <div className="mini-card">
          <div className="l">Win Rate</div>
          <div className="v">0%</div>
        </div>
      </div>

      <Navbar />

      <style jsx>{`
        .profile-container { min-height: 100vh; padding: 20px 16px 100px; transition: all 0.3s; }
        .profile-container.gold { background: #F5E6BE; color: #000; }
        .profile-container.dark { background: #0d1117; color: #c9d1d9; }

        .profile-header { text-align: center; margin-bottom: 30px; padding: 20px 0; }
        .avatar-circle { width: 100px; height: 100px; background: rgba(0,0,0,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; border: 3px solid #4B3621; }
        .dark .avatar-circle { background: #161b22; border-color: #30363d; }
        .user-name { font-size: 24px; font-weight: 900; margin: 0; }
        .user-id { font-size: 11px; opacity: 0.5; font-weight: 800; margin-top: 4px; font-family: monospace; }

        .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #6F4E37; }
        .dark .section-title { color: #8b949e; }

        .input-group { background: #FFF9E6; border-radius: 20px; padding: 8px; border: 1px solid #E6D5A8; margin-bottom: 24px; }
        .dark .input-group { background: #161b22; border-color: #30363d; }
        .input-row { display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .dark .input-row { border-color: #30363d; }
        .input-wrap { flex: 1; display: flex; flex-direction: column; }
        .input-wrap label { font-size: 10px; font-weight: 800; opacity: 0.5; text-transform: uppercase; }
        .input-wrap span { font-size: 16px; font-weight: 700; }
        .input-wrap input { background: transparent; border: 1px solid #E6D5A8; padding: 8px; border-radius: 8px; font-size: 16px; font-weight: 700; color: inherit; }

        .btn-action { width: 100%; background: #4B3621; color: #F5E6BE; border: none; padding: 14px; border-radius: 12px; margin-top: 8px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .dark .btn-action { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }

        .setting-toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #FFF9E6; border-radius: 16px; margin-bottom: 12px; border: 1px solid #E6D5A8; cursor: pointer; }
        .dark .setting-toggle-row { background: #161b22; border-color: #30363d; }
        .toggle-left { display: flex; align-items: center; gap: 16px; }
        .toggle-info .title { font-size: 15px; font-weight: 800; }
        .toggle-info .desc { font-size: 11px; opacity: 0.5; font-weight: 600; }

        .toggle-switch { width: 44px; height: 24px; background: #ccc; border-radius: 99px; position: relative; transition: 0.3s; }
        .toggle-switch.on { background: #2d6a4f; }
        .toggle-switch::after { content: ""; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.3s; }
        .toggle-switch.on::after { left: 23px; }

        .toggle-btn-mini { font-size: 11px; font-weight: 800; padding: 4px 10px; background: rgba(0,0,0,0.05); border-radius: 6px; }

        .stats-mini-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
        .mini-card { background: rgba(0,0,0,0.03); padding: 16px; border-radius: 16px; text-align: center; }
        .mini-card .l { font-size: 10px; font-weight: 800; opacity: 0.5; text-transform: uppercase; }
        .mini-card .v { font-size: 20px; font-weight: 900; }
      `}</style>
    </div>
  );
}
