import React from 'react';

interface FunModeBoardProps {
  /**
   * The current multiplier value to display.
   * e.g. 1.00, 2.54, etc.
   */
  multiplier?: number;
}

export default function FunModeBoard({ multiplier = 1.0 }: FunModeBoardProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Background Sunburst Effect ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // Subtle radial dark burst effect
          background: `
            radial-gradient(circle at center, transparent 20%, #000 90%),
            repeating-conic-gradient(from 0deg, #181818 0deg 3deg, #0a0a0a 3deg 6deg)
          `,
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />

      {/* ── Header ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#D88D27', // Match the golden-orange from screenshot
          padding: '4px 0',
          textAlign: 'center',
          fontWeight: '900',
          fontSize: '15px',
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderBottom: '2px solid #111',
          zIndex: 999, // Force to very top
        }}
      >
        Fun Mode
      </div>

      {/* ── Multiplier Text ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      >
        <div
          style={{
            fontSize: '80px', // Static size to guarantee rendering
            fontWeight: '900',
            color: '#FFFFFF',
            textShadow: '0 4px 10px rgba(0,0,0,0.8)',
            letterSpacing: '-2px',
          }}
        >
          {typeof multiplier === 'number' && !isNaN(multiplier) ? multiplier.toFixed(2) : '1.00'} x
        </div>
      </div>

      {/* ── Airplane SVG ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '6%',
          width: '28%',
          minWidth: '100px',
          maxWidth: '180px',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <svg
          viewBox="0 0 200 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', filter: 'drop-shadow(2px 8px 6px rgba(0,0,0,0.6))' }}
        >
          {/* 
            This path mimics a stylized biplane silhouette with a cross "X" on the tail/side 
            and a propeller on the nose.
          */}
          <g fill="#E01E2E">
            {/* Propeller Blur */}
            <path
              d="M 185 20 C 190 50 190 80 185 100 L 175 60 Z"
              opacity="0.8"
            />
            {/* Nose Hub */}
            <circle cx="178" cy="62" r="5" />
            
            {/* Main Fuselage Body */}
            <path d="M 30 75 C 70 75 130 65 175 62 C 175 75 140 85 80 95 C 50 100 20 90 10 78 C 5 70 20 75 30 75 Z" />
            
            {/* Top Wing */}
            <path d="M 60 40 C 100 35 150 32 165 40 L 150 48 C 120 45 75 48 50 52 Z" />
            
            {/* Struts (connecting top wing and body) */}
            <line x1="70" y1="50" x2="65" y2="78" stroke="#E01E2E" strokeWidth="4" />
            <line x1="100" y1="46" x2="95" y2="70" stroke="#E01E2E" strokeWidth="4" />
            <line x1="130" y1="42" x2="125" y2="65" stroke="#E01E2E" strokeWidth="4" />

            {/* Tail Wing */}
            <path d="M 15 78 L 0 45 C 10 40 30 45 45 60 Z" />

            {/* Landing Gear / Wheels */}
            <path d="M 60 92 L 50 110 L 70 112 Z" />
            <circle cx="60" cy="112" r="6" fill="#000" />
            
            <path d="M 120 82 L 110 102 L 130 100 Z" />
            <circle cx="120" cy="102" r="5" fill="#000" />

            {/* "X" marking on the back fuselage (simulated with a black path) */}
            <g transform="translate(15, 60)">
              <line x1="0" y1="0" x2="15" y2="15" stroke="#111" strokeWidth="4" strokeLinecap="round" />
              <line x1="15" y1="0" x2="0" y2="15" stroke="#111" strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
