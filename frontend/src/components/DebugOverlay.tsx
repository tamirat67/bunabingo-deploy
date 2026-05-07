'use client';
import { useState, useEffect } from 'react';
import { Terminal, X, Trash2 } from 'lucide-react';

let globalLogs: string[] = [];
let logListeners: ((logs: string[]) => void)[] = [];

// Override console to capture logs
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.message} \n ${a.stack}`;
      return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    globalLogs = [`[LOG] ${new Date().toLocaleTimeString()}: ${msg}`, ...globalLogs].slice(0, 50);
    logListeners.forEach(l => l(globalLogs));
    originalLog(...args);
  };

  console.error = (...args) => {
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.message} \n ${a.stack}`;
      return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    globalLogs = [`[ERR] ${new Date().toLocaleTimeString()}: ${msg}`, ...globalLogs].slice(0, 50);
    logListeners.forEach(l => l(globalLogs));
    originalError(...args);
  };
}

export default function DebugOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setLogs(globalLogs);
    const listener = (newLogs: string[]) => setLogs([...newLogs]);
    logListeners.push(listener);
    return () => {
      logListeners = logListeners.filter(l => l !== listener);
    };
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 99999,
          background: 'rgba(111, 78, 55, 0.8)',
          color: 'white',
          border: 'none',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
        }}
      >
        <Terminal size={16} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100000,
      background: '#1a1a1a',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '10px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '10px'}}>
        <span style={{fontWeight: 'bold', fontSize: '14px'}}>System Logs</span>
        <div style={{display: 'flex', gap: '15px'}}>
          <Trash2 size={20} onClick={() => { globalLogs = []; setLogs([]); }} style={{cursor: 'pointer'}} />
          <X size={20} onClick={() => setIsOpen(false)} style={{cursor: 'pointer'}} />
        </div>
      </div>
      <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px'}}>
        {logs.map((log, i) => (
          <div key={i} style={{
            borderBottom: '1px solid #222', 
            paddingBottom: '2px',
            color: log.startsWith('[ERR]') ? '#ff5555' : '#00ff00'
          }}>
            {log}
          </div>
        ))}
        {logs.length === 0 && <div style={{opacity: 0.5}}>No logs captured yet...</div>}
      </div>
    </div>
  );
}
