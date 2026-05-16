'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, AlertCircle, CheckCircle2, Coffee } from 'lucide-react';

interface BunaModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success';
}

export default function BunaModal({ isOpen, onClose, title, message, type = 'info' }: BunaModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 100000,
            }}
          />

          {/* Modal Container */}
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            pointerEvents: 'none',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: '360px',
                background: 'linear-gradient(135deg, #2c1810 0%, #1a0f0a 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(212, 175, 55, 0.1)',
                padding: '30px',
                textAlign: 'center',
                pointerEvents: 'auto',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Decorative Glow */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '150px',
                height: '150px',
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              {/* Icon / Medal */}
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 20px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #F5E050 50%, #B8860B 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 20px rgba(184, 134, 11, 0.3)',
                position: 'relative'
              }}>
                <div style={{
                   position: 'absolute',
                   inset: '4px',
                   borderRadius: '50%',
                   border: '2px solid rgba(255,255,255,0.3)',
                   pointerEvents: 'none'
                }} />
                <Trophy color="white" size={40} fill="rgba(255,255,255,0.2)" />
              </div>

              {/* Content */}
              <h3 style={{
                color: '#D4AF37',
                fontSize: '22px',
                fontWeight: 'bold',
                marginBottom: '12px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                letterSpacing: '0.5px'
              }}>
                {title}
              </h3>
              
              <p style={{
                color: '#e0d6d0',
                fontSize: '15px',
                lineHeight: '1.5',
                marginBottom: '25px',
                opacity: 0.9
              }}>
                {message}
              </p>

              {/* Action Button */}
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(90deg, #D4AF37, #B8860B)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(184, 134, 11, 0.2)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                GOT IT ☕️
              </button>

              {/* Close Icon (Top Right) */}
              <button 
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
