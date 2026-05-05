'use client';
import { useState } from 'react';
import { register } from '../lib/api';
import { useToast } from './Toast';
import { ShieldCheck, Phone, ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onSuccess: () => void;
}

export default function Onboarding({ onSuccess }: OnboardingProps) {
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleRequestContact = () => {
    if (typeof window === 'undefined' || !(window as any).Telegram?.WebApp) {
      show('Telegram environment not found', 'error');
      return;
    }

    const twa = (window as any).Telegram.WebApp;
    
    setLoading(true);
    
    // Trigger Native Telegram Bottom Sheet
    twa.requestContact(async (res: any) => {
      if (res.status === 'sent') {
        try {
          const phoneNumber = res.response_data?.phone_number || res.phone_number;
          // Extract referral from start_param if exists
          const startParam = new URLSearchParams(twa.initData).get('start_param');
          
          await register({ 
            phoneNumber, 
            referredById: startParam || undefined 
          });
          
          show('Verification Successful! Welcome ☕', 'success');
          onSuccess();
        } catch (err) {
          show('Registration failed. Try again.', 'error');
        } finally {
          setLoading(false);
        }
      } else {
        show('Verification required to play', 'info');
        setLoading(false);
      }
    });
  };

  return (
    <div className="onboard-overlay">
      <div className="onboard-sheet">
        <div className="sheet-handle"></div>
        
        <div className="sheet-content">
          <div className="icon-badge">
            <ShieldCheck size={40} />
          </div>
          
          <h2 className="sheet-title">Verify Your Account</h2>
          <p className="sheet-desc">
            To ensure fair play and secure payouts of your winnings, we require a one-time verification via your Telegram contact.
          </p>

          <div className="perks-list">
            <div className="perk">✅ Secure ETB Payouts</div>
            <div className="perk">✅ Verified Fair Play</div>
            <div className="perk">✅ Real-Money Bingo</div>
          </div>

          <button 
            className={`btn-verify ${loading ? 'loading' : ''}`} 
            onClick={handleRequestContact}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner-small"></div>
            ) : (
              <>
                <Phone size={20} />
                <span>SHARE CONTACT & JOIN</span>
                <ChevronRight size={20} />
              </>
            )}
          </button>
          
          <p className="privacy-note">We only use your contact for account verification.</p>
        </div>
      </div>

      <style jsx>{`
        .onboard-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); z-index: 9999;
          display: flex; align-items: flex-end;
          backdrop-filter: blur(8px);
        }
        .onboard-sheet {
          width: 100%; background: #F5E6BE;
          border-radius: 32px 32px 0 0;
          padding: 20px 24px 40px;
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 -20px 60px rgba(0,0,0,0.5);
          color: #4B3621;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .sheet-handle {
          width: 40px; height: 5px; background: rgba(75, 54, 33, 0.2);
          border-radius: 99px; margin: 0 auto 24px;
        }
        
        .sheet-content { text-align: center; }
        
        .icon-badge {
          width: 80px; height: 80px; background: #6b21a8; color: #facc15;
          border-radius: 24px; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px; box-shadow: 0 10px 25px rgba(107, 33, 168, 0.3);
        }
        
        .sheet-title { font-size: 24px; font-weight: 900; margin-bottom: 12px; }
        .sheet-desc { font-size: 14px; font-weight: 700; opacity: 0.8; line-height: 1.5; margin-bottom: 24px; }
        
        .perks-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 30px; }
        .perk { font-size: 13px; font-weight: 800; background: rgba(107, 33, 168, 0.05); padding: 8px 16px; border-radius: 12px; display: inline-block; align-self: center; }

        .btn-verify {
          width: 100%; background: #6b21a8; color: white; border: none;
          padding: 18px; border-radius: 18px; font-weight: 900; font-size: 16px;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          box-shadow: 0 10px 25px rgba(107, 33, 168, 0.3); cursor: pointer; transition: 0.2s;
        }
        .btn-verify:active { transform: scale(0.98); }
        .btn-verify.loading { opacity: 0.8; }
        
        .privacy-note { font-size: 11px; font-weight: 700; opacity: 0.5; margin-top: 16px; }

        .spinner-small {
          width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
