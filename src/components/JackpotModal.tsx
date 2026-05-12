'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, ExternalLink, Sparkles } from 'lucide-react';
import { markJackpotSeen } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface JackpotModalProps {
  show: boolean;
  onClose: () => void;
  jackpotAmount: string;
}

export default function JackpotModal({ show, onClose, jackpotAmount }: JackpotModalProps) {
  const [mounted, setMounted] = useState(false);
  const { T } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = async () => {
    try {
      await markJackpotSeen();
    } catch (e) {
      console.error('Failed to mark jackpot as seen:', e);
    }
    onClose();
  };

  if (!mounted || !show) return null;

  return (
    <AnimatePresence>
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        backdropFilter: 'blur(4px)',
        zIndex: 10000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px'
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          style={{ 
            background: T.card, 
            width: '100%', 
            maxWidth: '400px', 
            borderRadius: '24px', 
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}
        >
          {/* Header */}
          <div style={{ 
            padding: '16px 20px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: `1px solid ${T.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#9B59B6' }}></div>
               <span style={{ fontWeight: '900', fontSize: '18px', color: T.header, letterSpacing: '0.5px' }}>JACKPOT</span>
            </div>
            <button onClick={handleClose} style={{ color: '#95A5A6', border: 'none', background: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="custom-scroll" style={{ overflowY: 'auto', padding: '20px' }}>
            {/* Banner Image Area */}
            <div style={{ 
              width: '100%', 
              aspectRatio: '16/11', 
              background: 'linear-gradient(135deg, #000, #1a1a1a)',
              borderRadius: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
               <div style={{ textAlign: 'center', zIndex: 2 }}>
                  <div style={{ color: T.gold, fontSize: '12px', fontWeight: '900', marginBottom: '5px', letterSpacing: '2px' }}>B  I  N  G  O</div>
                  <div style={{ color: 'white', fontSize: '32px', fontWeight: '900', textShadow: '0 2px 10px rgba(241,196,15,0.5)' }}>Derash</div>
                  <div style={{ color: T.gold, fontSize: '42px', fontWeight: '900', lineHeight: 0.8, marginTop: '5px' }}>Jackpot</div>
                  <div style={{ color: 'white', fontSize: '18px', fontWeight: '400', marginTop: '10px', fontStyle: 'italic' }}>Win Big!</div>
               </div>
               
               {/* Decorative elements */}
               <div style={{ position: 'absolute', top: -20, left: -20, width: '100px', height: '100px', background: T.gold, opacity: 0.1, filter: 'blur(30px)', borderRadius: '50%' }}></div>
               <div style={{ position: 'absolute', bottom: -20, right: -20, width: '100px', height: '100px', background: '#9B59B6', opacity: 0.1, filter: 'blur(30px)', borderRadius: '50%' }}></div>
               <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
            </div>

            {/* Current Amount */}
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <div style={{ fontSize: '14px', color: '#7F8C8D', fontWeight: '700', marginBottom: '4px' }}>CURRENT PRIZE POOL</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: T.header, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ color: T.gold }}>{jackpotAmount}</span>
                <span style={{ fontSize: '16px', opacity: 0.5 }}>ETB</span>
              </div>
            </div>

            {/* Rules in Amharic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🎉</span>
                <p style={{ fontSize: '15px', fontWeight: '700', color: T.header }}>ታላቅ ዜና!</p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>💰</span>
                <p style={{ fontSize: '14px', color: '#34495E', lineHeight: 1.5 }}>የጃክፖት ሽልማት አሁን ተጀምሯል! 💰</p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🍀</span>
                <p style={{ fontSize: '14px', color: '#34495E', lineHeight: 1.5 }}>በመጫወት የጃክፖት ሽልማት አሸናፊ ይሁኑ! መልካም እድል! 🍀</p>
              </div>

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '15px', marginTop: '5px' }}>
                <p style={{ fontSize: '14px', fontWeight: '800', color: T.header, marginBottom: '12px' }}>👉👉 የደራሽ ጃክፖት አሰራር!</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>1</div>
                    <p style={{ fontSize: '13px', color: '#5D6D7E' }}>በእያንዳንዱ ጨዋታ የሚሰበሰበው መደብ ከ100 ሲበልጥ ከደራሹ ላይ የተወሰነ ፐርሰንት ወደ ጃክፖቱ ይተላለፋል።</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>2</div>
                    <p style={{ fontSize: '13px', color: '#5D6D7E' }}>ጃክፖቱ የታለመለትን መጠን (Target Amount) እስኪሞላ ድረስ መጠኑ ይጨምራል። 💥</p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>3</div>
                    <p style={{ fontSize: '13px', color: '#5D6D7E' }}>ልክ ታርጌቱ ሲሞላ፤ ጃክፖቱ ይፈነዳል።</p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>4</div>
                    <p style={{ fontSize: '13px', color: '#5D6D7E' }}>በዛ ሰዓት ያሸነፈው እድለኛ ተጫዋች ጠቅላላውን ጃክፖት + መደበኛውን ሽልማት ይወስዳል! 🏆</p>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: T.goldDk, marginTop: '20px' }}>
              🏆 እድሎን ይሞክሩ! መልካም እድል! 🍀
            </p>
          </div>

          {/* Footer Action */}
          <div style={{ padding: '20px', borderTop: `1px solid ${T.border}` }}>
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={handleClose}
              style={{ 
                width: '100%', 
                background: 'linear-gradient(135deg, #D81B60, #8E24AA)', 
                color: 'white', 
                border: 'none', 
                padding: '14px', 
                borderRadius: '16px', 
                fontWeight: '900', 
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(216, 27, 96, 0.3)'
              }}
            >
              <ExternalLink size={20} /> ተረዳሁ / GOT IT
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
