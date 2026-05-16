'use client';
import { useState } from 'react';
import { tg } from '../lib/telegram';
import { verifyPhone } from '../lib/api';
import { Phone, ShieldCheck, Coffee } from 'lucide-react';

export default function RegistrationOverlay({ onComplete }: { onComplete: (user: any) => void }) {
  const [loading, setLoading] = useState(false);

  const handleShareContact = () => {
    const app = tg();
    if (!app) {
      alert('Please open this in Telegram');
      return;
    }

    setLoading(true);
    app.requestContact((ok: boolean, response: any) => {
      if (ok && response?.responseLine) {
        verifyPhone(response).then((data: any) => {
          // data.user contains the updated user with phoneNumber
          onComplete(data.user);
        }).catch(err => {
          alert('Verification failed. Please try again.');
          console.error(err);
        }).finally(() => setLoading(false));
      } else {
        setLoading(false);
        alert('Sharing contact is required to play.');
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#FDF5E6',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      color: '#4B3621'
    }}>
      <div style={{
        width: '100px',
        height: '100px',
        background: '#6F4E37',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: '0 10px 30px rgba(111, 78, 55, 0.3)'
      }}>
        <Coffee size={50} color="#D4AF37" />
      </div>

      <h1 style={{fontSize: '28px', fontWeight: '900', marginBottom: '12px'}}>Welcome to Buna Bingo!</h1>
      <p style={{fontSize: '16px', opacity: 0.8, marginBottom: '32px', lineHeight: '1.5'}}>
        To ensure secure payouts and fair play, we need to verify your phone number.
      </p>

      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '20px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '40px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left'}}>
          <ShieldCheck color="#8DA242" size={24} />
          <div>
            <div style={{fontWeight: 'bold', fontSize: '14px'}}>Secure Verification</div>
            <div style={{fontSize: '11px', opacity: 0.6}}>Verified via Telegram Official</div>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left'}}>
          <Phone color="#D4AF37" size={24} />
          <div>
            <div style={{fontWeight: 'bold', fontSize: '14px'}}>One-Click Payouts</div>
            <div style={{fontSize: '11px', opacity: 0.6}}>Link your wallet to your number</div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleShareContact}
        disabled={loading}
        style={{
          width: '100%',
          background: '#E9E9EB', // Native-like light grey
          color: '#4B3621',
          border: 'none',
          padding: '16px',
          borderRadius: '30px', // Pill shape
          fontSize: '17px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginTop: 'auto'
        }}
      >
        {loading ? 'Verifying...' : 'Share Contact'}
      </button>

      <div style={{marginTop: 'auto', fontSize: '10px', opacity: 0.4}}>
        © Buna Bingo • Secure Telegram Mini App
      </div>
    </div>
  );
}
