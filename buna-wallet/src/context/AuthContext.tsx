import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { sendOTP, verifyOTP, normalizePhone } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthUser {
  phone: string;
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
      const result = await verifyOTP(pendingPhone, code);
      setUser({
        phone: result.phone || pendingPhone,
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
