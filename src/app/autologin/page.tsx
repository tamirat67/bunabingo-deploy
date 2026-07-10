'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

export default function AutoLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const tgId = searchParams.get('tgId');
    const ts = searchParams.get('ts');
    const sig = searchParams.get('sig');

    if (!tgId || !ts || !sig) {
      setStatus('error');
      setErrorMsg('Invalid link. Please request a new one from the bot by tapping "🌐 Chrome ውስጥ ክፈት".');
      return;
    }

    const attemptLogin = async () => {
      try {
        const res = await axios.get(
          `${API_URL}/api/auth/magic-login?tgId=${encodeURIComponent(tgId)}&ts=${ts}&sig=${encodeURIComponent(sig)}`
        );

        if (res.data.success && res.data.token) {
          // Save the token — api.ts picks it up automatically
          localStorage.setItem('admin_token', res.data.token);
          setStatus('success');
          // Redirect to the lobby after a short moment
          setTimeout(() => router.replace('/'), 800);
        } else {
          throw new Error('No token returned');
        }
      } catch (err: any) {
        const msg = err.response?.data?.error || 'Login failed. Please request a new link from the bot.';
        setErrorMsg(msg);
        setStatus('error');
      }
    };

    attemptLogin();
  }, [searchParams, router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '"Outfit", sans-serif',
      color: 'white',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {status === 'loading' && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            width: '60px', height: '60px',
            border: '4px solid rgba(212,175,55,0.2)',
            borderTop: '4px solid #D4AF37',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 24px',
          }} />
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>☕️</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#D4AF37' }}>ቡና ቢንጎ</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
            Logging you in...
          </div>
        </div>
      )}

      {status === 'success' && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#4ade80' }}>Login Successful!</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
            Redirecting to the game...
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease', maxWidth: '320px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#EF4444', marginBottom: '12px' }}>
            Link Expired
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
            {errorMsg}
          </div>
          <div style={{
            marginTop: '24px', padding: '12px 20px',
            background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37',
            borderRadius: '12px', fontSize: '13px', color: '#D4AF37',
          }}>
            Go back to the bot and tap<br />
            <strong>"🌐 Chrome ውስጥ ክፈት"</strong><br />
            to get a fresh link.
          </div>
        </div>
      )}
    </div>
  );
}
