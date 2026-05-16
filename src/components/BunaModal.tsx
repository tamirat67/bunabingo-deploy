'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, Info, HelpCircle, Wallet } from 'lucide-react';

interface BunaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'confirm' | 'balance';
  confirmText?: string;
  cancelText?: string;
}

export default function BunaModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title, 
  message, 
  type = 'info',
  confirmText = 'OK',
  cancelText = 'CANCEL'
}: BunaModalProps) {
  
  // Hardcoded Premium Brand Colors for Popups (Espresso & Gold)
  const colors = {
    espresso: '#1A0F0A',
    darkCoffee: '#0F0A08',
    lightGold: '#F5E050',
    classicGold: '#D4AF37',
    error: '#ff4d4d',
    success: '#2ecc71',
    confirm: '#3498db'
  };

  const getIcon = () => {
    switch (type) {
      case 'error':   return <AlertCircle color={colors.error} size={40} />;
      case 'success': return <CheckCircle2 color={colors.success} size={40} />;
      case 'confirm': return <HelpCircle color={colors.confirm} size={40} />;
      case 'balance': return <Wallet color={colors.classicGold} size={40} />;
      default:        return <Info color={colors.classicGold} size={40} />;
    }
  };

  const getThemeColor = () => {
    switch (type) {
      case 'error':   return colors.error;
      case 'success': return colors.success;
      case 'confirm': return colors.confirm;
      default:        return colors.classicGold;
    }
  };

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
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
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
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 20, stiffness: 250 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                background: colors.espresso,
                backgroundImage: `radial-gradient(circle at 50% 0%, ${getThemeColor()}22 0%, transparent 75%)`,
                borderRadius: '30px',
                border: `1px solid ${getThemeColor()}44`,
                boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 40px ${getThemeColor()}11`,
                padding: '35px 25px',
                textAlign: 'center',
                pointerEvents: 'auto',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              {/* Top Accent Line */}
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                height: '4px',
                background: `linear-gradient(90deg, transparent, ${getThemeColor()}, transparent)`
              }} />

              {/* Icon Container */}
              <div style={{
                width: '85px',
                height: '85px',
                margin: '0 auto 25px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${getThemeColor()}33`,
                position: 'relative'
              }}>
                {getIcon()}
                <motion.div 
                   animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                   transition={{ repeat: Infinity, duration: 2.5 }}
                   style={{
                      position: 'absolute',
                      inset: -12,
                      borderRadius: '50%',
                      border: `1px solid ${getThemeColor()}11`
                   }}
                />
              </div>

              {/* Text Content */}
              <h3 style={{
                color: 'white',
                fontSize: '22px',
                fontWeight: '900',
                marginBottom: '12px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}>
                {title}
              </h3>
              
              <p style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '15px',
                lineHeight: '1.6',
                marginBottom: '35px',
                fontWeight: '500'
              }}>
                {message}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {onConfirm && (
                   <button
                    onClick={onClose}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '18px',
                      fontSize: '13px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      opacity: 0.6
                    }}
                  >
                    {cancelText.toUpperCase()}
                  </button>
                )}
                
                <button
                  onClick={onConfirm || onClose}
                  style={{
                    flex: 2,
                    padding: '16px',
                    background: `linear-gradient(135deg, ${colors.classicGold}, #B8860B)`,
                    color: colors.espresso,
                    border: 'none',
                    borderRadius: '18px',
                    fontSize: '14px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: `0 8px 25px ${colors.classicGold}44`,
                  }}
                >
                  {(onConfirm ? confirmText : (type === 'balance' ? 'DEPOSIT NOW' : 'GOT IT')).toUpperCase()}
                </button>
              </div>

              {/* Top Close Button */}
              <button 
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
