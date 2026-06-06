'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Promotion {
  id: string;
  title: string;
  message: string;
  type: string;
  imageUrl?: string | null;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

export default function AnnouncementPage() {
  const params = useParams();
  const id = params?.id as string;
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/promotions/${id}/public`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setPromo(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const typeEmoji: Record<string, string> = {
    announcement: '📢',
    daily: '📅',
    weekly: '📆',
    custom: '🎯',
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; min-height: 100vh; font-family: 'Segoe UI', system-ui, sans-serif; }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a0a00 0%, #0d0d0d 50%, #001a0d 100%);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px 16px 80px;
        }

        .card {
          width: 100%;
          max-width: 680px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.05);
          animation: fadeUp 0.5s ease-out forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .banner-img {
          width: 100%;
          max-height: 320px;
          object-fit: cover;
          display: block;
        }

        .header {
          padding: 32px 32px 0;
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .emoji-badge {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #d4af37, #f5d36a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(212,175,55,0.3);
        }

        .title-block { flex: 1; }

        .type-pill {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(212,175,55,0.15);
          border: 1px solid rgba(212,175,55,0.3);
          color: #d4af37;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .title {
          font-size: 24px;
          font-weight: 900;
          color: #f5f0e8;
          line-height: 1.3;
        }

        .date {
          margin-top: 6px;
          font-size: 13px;
          color: #6b6560;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent);
          margin: 24px 32px;
        }

        .message {
          padding: 0 32px 32px;
          font-size: 15px;
          color: #c8c0b4;
          line-height: 1.85;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .footer {
          padding: 20px 32px 28px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: center;
        }

        .play-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 32px;
          border-radius: 50px;
          background: linear-gradient(135deg, #d4af37, #f5d36a);
          color: #1a0a00;
          font-size: 15px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(212,175,55,0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .play-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(212,175,55,0.4);
        }

        .loading, .error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #6b6560;
          gap: 16px;
          font-size: 15px;
        }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid rgba(212,175,55,0.2);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .brand {
          text-align: center;
          padding: 0 32px 16px;
        }
        .brand span {
          font-size: 13px;
          color: #3d352a;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
      `}</style>

      <div className="page">
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Loading announcement…</span>
          </div>
        )}

        {error && !loading && (
          <div className="error">
            <span style={{ fontSize: 40 }}>😕</span>
            <span>Announcement not found or has been removed.</span>
            <a href="https://t.me/buna_bingobot" className="play-btn" style={{ marginTop: 8 }}>
              🎮 Open Buna Bingo
            </a>
          </div>
        )}

        {promo && !loading && (
          <div className="card">
            {promo.imageUrl && (
              <img
                className="banner-img"
                src={promo.imageUrl.startsWith('/uploads/')
                  ? `${API_BASE}${promo.imageUrl}`
                  : promo.imageUrl}
                alt={promo.title}
              />
            )}

            <div className="header">
              <div className="emoji-badge">{typeEmoji[promo.type] || '📢'}</div>
              <div className="title-block">
                <div className="type-pill">{promo.type}</div>
                <div className="title">{promo.title}</div>
                <div className="date">{formatDate(promo.createdAt)}</div>
              </div>
            </div>

            <div className="divider" />

            <div className="message">{promo.message}</div>

            <div className="footer">
              <a href="https://t.me/buna_bingobot" className="play-btn">
                🎮 Play Buna Bingo
              </a>
            </div>

            <div className="brand">
              <span>bunatechhub.net</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
