import React from 'react';

interface FunModeBoardProps {
  multiplier?: number;
}

export default function FunModeBoard({ multiplier = 1.0 }: FunModeBoardProps) {
  const displayValue =
    typeof multiplier === 'number' && !isNaN(multiplier)
      ? multiplier.toFixed(2)
      : '1.00';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '42vw',
        minHeight: '220px',
        maxHeight: '340px',
        background: '#0a0a0a',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Sunburst background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 70% 50%, transparent 15%, rgba(0,0,0,0.85) 80%),
            repeating-conic-gradient(from 0deg at 70% 50%, #1a1a1a 0deg 3deg, #0a0a0a 3deg 6deg)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* FUN MODE header bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#C68B1A',
          padding: '5px 0',
          textAlign: 'center',
          fontWeight: '900',
          fontSize: '13px',
          color: '#FFFFFF',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          zIndex: 10,
        }}
      >
        Fun Mode
      </div>

      {/* Multiplier text — centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(48px, 11vw, 110px)',
            fontWeight: '900',
            color: '#FFFFFF',
            fontFamily: "'Arial Black', Arial, sans-serif",
            letterSpacing: '-1px',
            textShadow: '0 2px 12px rgba(0,0,0,0.9)',
            lineHeight: 1,
          }}
        >
          {displayValue} x
        </span>
      </div>

      {/* Red biplane SVG — bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '4%',
          width: '26%',
          minWidth: '90px',
          maxWidth: '170px',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <svg
          viewBox="0 0 220 130"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.7))' }}
        >
          <g fill="#D42030">
            {/* Propeller arc */}
            <ellipse cx="205" cy="65" rx="6" ry="38" opacity="0.7" />
            {/* Nose hub */}
            <circle cx="200" cy="65" r="6" />
            {/* Main fuselage */}
            <path d="M 35 78 C 80 76 145 67 198 65 C 198 78 158 90 90 98 C 55 103 22 93 12 80 C 7 72 22 78 35 78 Z" />
            {/* Top wing */}
            <path d="M 65 42 C 110 36 158 34 175 42 L 160 51 C 128 47 82 50 55 55 Z" />
            {/* Wing struts */}
            <rect x="74" y="52" width="4" height="26" rx="2" />
            <rect x="108" y="48" width="4" height="24" rx="2" />
            <rect x="142" y="44" width="4" height="23" rx="2" />
            {/* Tail fin */}
            <path d="M 18 80 L 2 48 C 12 43 32 48 48 63 Z" />
            {/* X marking on fuselage */}
            <line x1="20" y1="74" x2="32" y2="86" stroke="#8B0000" strokeWidth="3" strokeLinecap="round" />
            <line x1="32" y1="74" x2="20" y2="86" stroke="#8B0000" strokeWidth="3" strokeLinecap="round" />
            {/* Front landing gear */}
            <path d="M 130 96 L 120 115 L 145 113 Z" />
            <circle cx="132" cy="115" r="7" fill="#111" />
            {/* Rear landing gear */}
            <path d="M 70 100 L 60 116 L 82 114 Z" />
            <circle cx="71" cy="116" r="6" fill="#111" />
          </g>
        </svg>
      </div>
    </div>
  );
}
