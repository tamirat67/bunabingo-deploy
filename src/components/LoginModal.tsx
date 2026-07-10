import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: { isOpen: boolean, onClose: () => void, onLoginSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/login', {
        username: phone,
        password: password
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('admin_token', res.data.token); // api.ts already checks this
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your phone and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              background: '#1E293B',
              padding: '24px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '350px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              border: '1px solid #D4AF37'
            }}
          >
            <h2 style={{ color: '#D4AF37', margin: '0 0 20px 0', fontSize: '20px', textAlign: 'center', fontWeight: '900' }}>
              LOG IN
            </h2>
            
            {error && <div style={{ color: '#EF4444', fontSize: '14px', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '5px' }}>Phone Number</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +251911234567"
                  required
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    background: '#0F172A', border: '1px solid rgba(212,175,55,0.3)',
                    color: 'white', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '5px' }}>Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    background: '#0F172A', border: '1px solid rgba(212,175,55,0.3)',
                    color: 'white', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    background: '#D4AF37', border: 'none',
                    color: '#0F172A', fontWeight: '900', cursor: 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'LOGGING IN...' : 'LOG IN'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
