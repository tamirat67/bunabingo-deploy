'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  countdown: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  private _reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  public state: State = {
    hasError: false,
    countdown: 5,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, countdown: 5 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    // Auto-reload after 5 seconds to recover from transient errors
    this._countdownTimer = setInterval(() => {
      this.setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(this._countdownTimer!);
          return prev;
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
    this._reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 5000);
  }

  public componentWillUnmount() {
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: '#0F172A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', textAlign: 'center', zIndex: 9999,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#F59E0B', fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '24px' }}>
            Reloading in {this.state.countdown}s...
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', backgroundColor: '#F59E0B',
              color: '#0F172A', border: 'none', borderRadius: '12px',
              fontWeight: 900, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Reload Now
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
