import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { sendOTP, verifyOTP, normalizePhone } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  userId?: string;
  phone: string;
  name: string;
  walletId: string;
  balance: number;
  totalAssets: number;
  token: string;
  isNewUser: boolean;
}

type AuthStep = 'splash' | 'login' | 'otp' | 'authenticated';

interface AuthContextValue {
  step: AuthStep;
  user: AuthUser | null;
  pendingPhone: string;

  // Actions
  goToLogin: () => void;
  requestOTP: (phone: string) => Promise<void>;
  confirmOTP: (code: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  startTelegramAuth: () => Promise<string>;
  refreshProfile: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  logout: () => void;

  // Status
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [step, setStep] = useState<AuthStep>('splash');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingPhone, setPendingPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const goToLogin = useCallback(() => {
    setStep('login');
    setError(null);
  }, []);

  // ── Step 1: Send OTP ───────────────────────────────────────────────────────
  const requestOTP = useCallback(async (phone: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const normalized = normalizePhone(phone);
      await sendOTP(normalized);
      setPendingPhone(normalized);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const resendOTP = useCallback(async () => {
    if (!pendingPhone) return;
    setIsLoading(true);
    setError(null);
    try {
      await sendOTP(pendingPhone);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pendingPhone]);

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  const confirmOTP = useCallback(async (code: string) => {
    if (!pendingPhone) {
      setError('Session expired. Please start again.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result: any = await verifyOTP(pendingPhone, code);
      setUser({
        userId: result.userId,
        phone: result.phone || pendingPhone,
        name: result.name || 'Buna User',
        walletId: result.walletId || `BW-${(result.phone || pendingPhone).slice(-7)}`,
        balance: typeof result.balance === 'number' ? result.balance : parseFloat(result.balance || '0'),
        totalAssets: typeof result.totalAssets === 'number' ? result.totalAssets : parseFloat(result.totalAssets || '0'),
        token: result.token || '',
        isNewUser: result.isNewUser ?? false,
      });
      setStep('authenticated');
    } catch (err: any) {
      setError(err.message || 'Incorrect code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pendingPhone]);

  // ── Refresh User Profile & Balance ─────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const query = user.userId
        ? `userId=${encodeURIComponent(user.userId)}`
        : `phone=${encodeURIComponent(user.phone)}`;
      const res = await fetch(`https://api.bunatechhub.net/api/user/profile?${query}`);
      const data = await res.json();
      if (data.success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                name: data.name || prev.name,
                walletId: data.walletId || prev.walletId,
                balance: typeof data.balance === 'number' ? data.balance : parseFloat(data.balance || '0'),
                totalAssets: typeof data.totalAssets === 'number' ? data.totalAssets : parseFloat(data.totalAssets || '0'),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  }, [user]);

  // ── Update Profile Name ────────────────────────────────────────────────────
  const updateProfileName = useCallback(async (newName: string) => {
    if (!user?.userId) return;
    try {
      const res = await fetch(`https://api.bunatechhub.net/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        setUser((prev) => (prev ? { ...prev, name: newName } : null));
      }
    } catch (err) {
      console.error('Failed to update profile name:', err);
    }
  }, [user]);

  // ── Step 3: Telegram Native Auth ───────────────────────────────────────────
  const startTelegramAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Generate a random session ID
      const sessionId = 'tg_' + Math.random().toString(36).substring(2, 15);
      
      // 2. We don't change 'step' yet. LoginScreen will open the URL and poll.
      return sessionId;
    } catch (err: any) {
      setError(err.message || 'Failed to start Telegram login.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setPendingPhone('');
    setStep('login');
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        step,
        user,
        pendingPhone,
        goToLogin,
        requestOTP,
        confirmOTP,
        resendOTP,
        startTelegramAuth,
        refreshProfile,
        updateProfileName,
        logout,
        isLoading,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
};
