"use client";

import React, { useEffect, useState } from 'react';
import { FiSettings, FiDollarSign, FiUsers, FiShield, FiSave, FiAlertCircle, FiCoffee, FiTrendingUp } from 'react-icons/fi';
import api from '@/lib/api';
import '@/app/admin.css';

export default function SettingsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/admin/rooms');
      setRooms(res.data || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoom = async (roomId: string, data: any) => {
    setSaving(roomId);
    try {
      await api.patch(`/admin/rooms/${roomId}`, data);
      await fetchRooms();
    } catch (err) {
      alert('Update failed.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#3d2b1f', margin: 0 }}>System Control</h1>
        <p style={{ color: '#78716c', margin: '4px 0 0', fontSize: '14px' }}>Fine-tune your platform's financial and game engine</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '40px' }}>
        {/* Room Pricing Control */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#3d2b1f', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiCoffee style={{ color: '#d4af37' }} /> Game Room Pricing
          </h2>
          
          {loading ? (
             <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '24px', border: '1px solid #f5f5f4' }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
             </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {rooms.map(room => (
                <div key={room.id} className="stat-card-m" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div className="user-avatar" style={{ width: '50px', height: '50px', background: '#3d2b1f', color: '#d4af37' }}>
                    <FiDollarSign size={20} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '900', color: '#3d2b1f', fontSize: '16px' }}>{room.type} Room</div>
                    <div style={{ fontSize: '12px', color: '#78716c' }}>Min Players: {room.minPlayers}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', fontSize: '12px', color: '#d4af37' }}>ETB</span>
                      <input 
                        type="number" 
                        className="login-input" 
                        style={{ width: '120px', paddingLeft: '44px', fontWeight: '800' }}
                        defaultValue={parseFloat(room.ticketPrice)}
                        onBlur={(e) => {
                          const newPrice = parseFloat(e.target.value);
                          if (newPrice !== parseFloat(room.ticketPrice)) {
                            handleUpdateRoom(room.id, { ticketPrice: newPrice });
                          }
                        }}
                      />
                    </div>
                    
                    <div 
                      onClick={() => handleUpdateRoom(room.id, { isActive: !room.isActive })}
                      style={{ 
                        width: '50px', 
                        height: '28px', 
                        background: room.isActive ? '#22c55e' : '#e7e5e4', 
                        borderRadius: '20px', 
                        position: 'relative', 
                        cursor: 'pointer',
                        transition: '0.3s'
                      }}
                    >
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        background: 'white', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '4px', 
                        left: room.isActive ? '26px' : '4px',
                        transition: '0.3s'
                      }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Settings & Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div className="stat-card-m" style={{ background: '#3d2b1f', borderColor: '#3d2b1f', color: 'white' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiTrendingUp color="#d4af37" /> PLATFORM MARGINS
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#a8a29e', fontSize: '13px' }}>Default House Edge</span>
                <span style={{ fontWeight: '800', color: '#d4af37' }}>20%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a8a29e', fontSize: '13px' }}>Jackpot Contribution</span>
                <span style={{ fontWeight: '800', color: '#d4af37' }}>1%</span>
              </div>
           </div>

           <div className="stat-card-m">
              <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 16px', color: '#3d2b1f' }}>SYSTEM STATS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Engine: <b>Optimized</b></span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Database: <b>Healthy</b></span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4af37' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Webhook: <b>Active</b></span>
                 </div>
              </div>
           </div>

           <div style={{ padding: '20px', background: '#fffcf0', borderRadius: '20px', border: '1px solid #fef3c7', display: 'flex', gap: '12px' }}>
              <FiAlertCircle color="#d4af37" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontWeight: '600', lineHeight: '1.5' }}>
                Changes to ticket prices affect new games immediately. Ongoing games will finish with their original pricing.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
