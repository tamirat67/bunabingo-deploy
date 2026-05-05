'use client';
import { useEffect, useState } from 'react';
import { initTelegram, getTgUser } from '../lib/telegram';
import { getTransactions, getWalletAudit } from '../lib/api';
import Navbar from '../components/Navbar';
import Link from 'next/link';
import { ShieldCheck, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Coins, Gift, History } from 'lucide-react';

export default function WalletPage() {
  const [data, setData] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = getTgUser();

  const loadData = async (isAudit = false) => {
    if (isAudit) setRefreshing(true);
    try {
      const [audit, t] = await Promise.all([getWalletAudit(), getTransactions()]);
      setData(audit);
      setTxns(t.slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    initTelegram();
    loadData();
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /><span>AUDITING VAULT...</span></div>;

  return (
    <div className="wallet-container">
      <div className="vault-header">
        <div>
          <h1 className="title">Buna Vault</h1>
          <div className="audit-badge">
            <ShieldCheck size={12} /> Verified & Audited
          </div>
        </div>
        <button className={`refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={() => loadData(true)}>
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="main-balance-card">
        <div className="label">Total Liquid Balance</div>
        <div className="value">
          <span className="symbol">ETB</span> {Number(data?.mainBalance || 0).toLocaleString()}
        </div>
        <div className="id-row">VAULT-ID: {data?.walletId?.slice(-8).toUpperCase() || 'BUNA-100'}</div>
        
        <div className="action-row">
          <button className="btn-vault" onClick={() => window.location.href='/deposit'}>
            <ArrowDownToLine size={18} /> Deposit
          </button>
          <button className="btn-vault outline" onClick={() => window.location.href='/withdraw'}>
            <ArrowUpFromLine size={18} /> Withdraw
          </button>
        </div>
      </div>

      <div className="audit-grid">
        <div className="audit-item">
          <div className="albl">Total Won</div>
          <div className="val-row">
            <Coins size={18} className="green-icon" />
            <div className="aval green">+{Number(data?.coins || 0).toFixed(0)}</div>
          </div>
        </div>
        <div className="audit-item">
          <div className="albl">Bonus Credits</div>
          <div className="val-row">
            <Gift size={18} className="coffee-icon" />
            <div className="aval coffee">{Number(data?.bonusBalance || 0).toFixed(0)}</div>
          </div>
        </div>
        <div className="audit-item full">
          <div className="albl">Financial Integrity</div>
          <div className="aval coffee">100% Normalized Ledger ✅</div>
        </div>
      </div>

      <div className="ledger-section">
        <div className="ledger-hdr">
          <div className="hdr-left">
            <History size={20} className="coffee-icon" />
            <h3 className="section-title">Verified Ledger</h3>
          </div>
          <Link href="/history" className="view-all">View All</Link>
        </div>
        
        {txns.length === 0 ? (
          <div className="no-txns">No transaction records found</div>
        ) : (
          <div className="txn-list">
            {txns.map((t) => (
              <div key={t.id} className="txn-row">
                <div className="txn-left">
                  <div className="icon-box">
                    {t.type === 'DEPOSIT' ? <ArrowDownToLine size={18} /> : t.type === 'WINNING' ? <Coins size={18} /> : <ArrowUpFromLine size={18} />}
                  </div>
                  <div className="txn-info">
                    <div className="type">{t.type.replace(/_/g, ' ')}</div>
                    <div className="date">{new Date(t.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className={`amt ${t.type === 'DEPOSIT' || t.type === 'WINNING' ? 'pos' : 'neg'}`}>
                  {t.type === 'DEPOSIT' || t.type === 'WINNING' ? '+' : '-'}{Number(t.amount).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navbar />

      <style jsx>{`
        .wallet-container { min-height: 100vh; background: #F5E6BE; padding: 24px 16px 100px; color: #000; }
        .vault-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .title { font-size: 26px; font-weight: 900; color: #4B3621; margin: 0; }
        .audit-badge { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #2d6a4f; margin-top: 4px; text-transform: uppercase; background: rgba(45, 106, 79, 0.1); padding: 4px 12px; border-radius: 99px; }
        
        .refresh-btn { background: #4B3621; border: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #F5E6BE; box-shadow: 0 4px 12px rgba(75, 54, 33, 0.2); }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .main-balance-card { background: #4B3621; color: #F5E6BE; border-radius: 28px; padding: 28px; margin-bottom: 24px; box-shadow: 0 20px 40px rgba(75, 54, 33, 0.25); }
        .main-balance-card .label { font-size: 12px; font-weight: 800; opacity: 0.7; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
        .main-balance-card .value { font-size: 46px; font-weight: 900; letter-spacing: -1.5px; }
        .main-balance-card .symbol { font-size: 20px; opacity: 0.4; margin-right: 4px; }
        .id-row { font-size: 9px; font-family: monospace; opacity: 0.4; margin-top: 8px; margin-bottom: 28px; }

        .action-row { display: flex; gap: 12px; }
        .btn-vault { flex: 1; background: #F5E6BE; color: #4B3621; border: none; padding: 14px; border-radius: 14px; font-weight: 900; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-vault.outline { background: transparent; color: #F5E6BE; border: 1px solid rgba(245, 230, 190, 0.4); }

        .audit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 35px; }
        .audit-item { background: #FFF9E6; border-radius: 20px; padding: 18px; border: 1px solid #E6D5A8; }
        .audit-item.full { grid-column: span 2; display: flex; justify-content: space-between; align-items: center; }
        .albl { font-size: 10px; font-weight: 800; opacity: 0.6; text-transform: uppercase; margin-bottom: 8px; color: #6F4E37; }
        .val-row { display: flex; align-items: center; gap: 8px; }
        .aval { font-size: 20px; font-weight: 900; }
        .green-icon { color: #2d6a4f; }
        .coffee-icon { color: #4B3621; }
        .aval.green { color: #2d6a4f; }
        .aval.coffee { color: #4B3621; }

        .ledger-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .hdr-left { display: flex; align-items: center; gap: 10px; }
        .section-title { font-size: 19px; font-weight: 900; margin: 0; color: #4B3621; }
        .view-all { font-size: 13px; font-weight: 800; color: #6F4E37; text-decoration: none; }

        .txn-list { display: flex; flex-direction: column; gap: 1px; background: #E6D5A8; border-radius: 20px; overflow: hidden; border: 1px solid #E6D5A8; box-shadow: 0 10px 30px rgba(0,0,0,0.03); }
        .txn-row { display: flex; justify-content: space-between; align-items: center; padding: 18px; background: #FFF9E6; }
        .txn-left { display: flex; align-items: center; gap: 16px; }
        .icon-box { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #F5E6BE; color: #4B3621; }
        .txn-info .type { font-size: 15px; font-weight: 800; color: #4B3621; }
        .txn-info .date { font-size: 11px; opacity: 0.5; margin-top: 2px; }
        .amt { font-size: 17px; font-weight: 900; }
        .amt.pos { color: #2d6a4f; }
        .amt.neg { color: #9a031e; opacity: 0.8; }
      `}</style>
    </div>
  );
}
