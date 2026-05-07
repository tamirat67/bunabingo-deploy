'use client';
import { useEffect, useState } from 'react';
import { getMe, getWallet } from '../lib/api';
import Navbar from '../components/Navbar';
import { RefreshCw, User, CheckCircle, Wallet as WalletIcon, Coins, Download } from 'lucide-react';

export default function WalletPage() {
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState('balance');

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="wallet-container">
      <div className="wallet-header">
        <span>Wallet</span>
        <RefreshCw size={24} onClick={() => window.location.reload()} />
      </div>

      <div className="verified-card">
        <div className="phone-info">
          <User size={20} opacity={0.5} />
          <span>{user?.phoneNumber || '0900000000'}</span>
        </div>
        <div className="verified-badge">
          <CheckCircle size={12} />
          <span>Verified</span>
        </div>
      </div>

      <div className="wallet-tabs">
        <div className={`wallet-tab ${tab === 'balance' ? 'active' : ''}`} onClick={() => setTab('balance')}>Balance</div>
        <div className={`wallet-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</div>
      </div>

      {tab === 'balance' ? (
        <>
          <div className="main-balance-card">
            <div className="balance-row main">
              <span className="label">Main Balance</span>
              <span className="value">{(user?.wallet?.balance || 0).toFixed(0)} Birr</span>
            </div>

            <div className="sub-balance-box">
              <div className="box-left">
                <WalletIcon size={18} opacity={0.5} />
                <span>Bonus Balance</span>
              </div>
              <span className="box-value" style={{color: '#66bb6a'}}>0</span>
            </div>

            <div className="sub-balance-box">
              <div className="box-left">
                <Coins size={18} color="#fbc02d" />
                <span>Coins</span>
              </div>
              <span className="box-value" style={{color: '#fbc02d'}}>0</span>
            </div>

            <button className="btn-convert">
              <Download size={18} />
              <span>Convert Coin</span>
            </button>
          </div>

          <div className="recent-section" style={{marginTop: '20px'}}>
            <h3 className="recent-title">Recent Transactions</h3>
            <div className="empty-state">No recent transactions</div>
          </div>
        </>
      ) : (
        <div className="empty-state">No history available</div>
      )}

      <div style={{textAlign: 'center', opacity: 0.3, fontSize: '10px', marginTop: 'auto'}}>© Addis Bingo</div>

      <Navbar />
    </div>
  );
}
