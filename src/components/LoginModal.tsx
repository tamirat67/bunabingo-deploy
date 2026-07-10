import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const SAVED_PHONE_KEY = 'buna_saved_phone'; // Only phone is saved — never the password
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bunatechhub.net';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}) {
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Auto-fill saved phone on open (password is never stored for security)
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedPhone = localStorage.getItem(SAVED_PHONE_KEY) || '';
      if (savedPhone) setPhone(savedPhone);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        username: phone.trim(),
        password: password,
      });

      if (res.data.success && res.data.token) {
        // Save session token (lasts 365 days — permanent login)
        localStorage.setItem('admin_token', res.data.token);

        // Remember only the phone for next time convenience (never save password)
        localStorage.setItem(SAVED_PHONE_KEY, phone.trim());

        onLoginSuccess();
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Login failed. Please check your phone and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    background: '#0F172A',
    border: '1px solid rgba(212,175,55,0.3)',
    color: 'white',
    outline: 'none',
    fontSize: '15px',
    boxSizing: 'border-box',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              padding: '28px',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '360px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #D4AF3740',
              border: '1px solid #D4AF3750',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>☕️</div>
              <h2 style={{ color: '#D4AF37', margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '1px' }}>
                BUNA BINGO
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '4px 0 0' }}>
                Log in to your account
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  color: '#FCA5A5', fontSize: '13px', marginBottom: '16px',
                  textAlign: 'center', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px',
                }}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Phone */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px', fontWeight: '700', letterSpacing: '0.5px' }}>
                  📱 PHONE NUMBER
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+251911234567"
                  required
                  autoComplete="tel"
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px', fontWeight: '700', letterSpacing: '0.5px' }}>
                  🔑 PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password from the bot"
                    required
                    autoComplete="current-password"
                    style={{ ...inputStyle, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                    }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Hint */}
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: '1.5' }}>
                No password? Go to the bot and tap<br />
                <span style={{ color: '#D4AF37' }}>🔑 የይለፍ ቃል (Password)</span>
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)', fontWeight: '700', cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '10px',
                    background: loading ? 'rgba(212,175,55,0.5)' : 'linear-gradient(90deg, #D4AF37, #B8860B)',
                    border: 'none',
                    color: '#0F172A', fontWeight: '900', cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '15px', letterSpacing: '0.5px',
                    boxShadow: loading ? 'none' : '0 4px 15px rgba(212,175,55,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? '⏳ Logging in...' : '🎮 LOG IN'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
