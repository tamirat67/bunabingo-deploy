'use client';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FDF5E6',
      padding: '20px',
      textAlign: 'center',
      color: '#6F4E37'
    }}>
      <h2 style={{fontWeight: '900', marginBottom: '10px'}}>Oops! Something went wrong</h2>
      <p style={{fontSize: '14px', opacity: 0.7, marginBottom: '20px'}}>
        The Telegram session might have timed out or a connection was lost.
      </p>
      <button
        onClick={() => reset()}
        style={{
          background: '#6F4E37',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 'bold'
        }}
      >
        <RefreshCw size={20} />
        Try Again
      </button>
    </div>
  );
}
