'use client';
import { useEffect, useState } from 'react';

interface SplashProps {
  onFinish: () => void;
  isLoading: boolean;
}

export default function Splash({ onFinish, isLoading }: SplashProps) {
  const [fading, setFading] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    // Ensure the splash screen shows for at least 1.5 seconds for the "boom" effect
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // If loading is done AND minimum time has passed, start fading out
    if (!isLoading && minTimePassed) {
      setFading(true);
      const timer = setTimeout(() => {
        onFinish();
      }, 400); // Wait for fade-out animation to complete
      return () => clearTimeout(timer);
    }
  }, [isLoading, minTimePassed, onFinish]);

  return (
    <div className={`splash-container ${fading ? 'fade-out' : ''}`}>
      <div className="logo-boom">
        <img src="/logo.jpg" alt="Buna Bingo Logo" className="brand-logo" />
      </div>

      <style jsx>{`
        .splash-container {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: #4B3621; /* Deep Coffee Bean */
          display: flex; justify-content: center; align-items: center;
          z-index: 99999;
          transition: opacity 0.4s ease;
        }
        .fade-out { opacity: 0; pointer-events: none; }

        .logo-boom {
          animation: boom 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          display: flex; justify-content: center; align-items: center;
        }

        .brand-logo {
          width: 250px; height: 250px;
          border-radius: 50%;
          box-shadow: 0 15px 50px rgba(0,0,0,0.6);
          object-fit: cover;
          border: 4px solid #D4AF37; /* Golden border to match the design */
        }

        @keyframes boom {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
