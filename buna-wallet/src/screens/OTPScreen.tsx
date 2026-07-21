import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows } from '../theme';
import { GradientButton } from '../components/GradientButton';
import { H2, H3, Body, Caption } from '../components/Typography';
import { useAuth } from '../context/AuthContext';

const OTP_LENGTH = 6;

export const OTPScreen: React.FC = () => {
  const { pendingPhone, confirmOTP, resendOTP, isLoading, error, clearError, goToLogin } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [shakingIndex, setShakingIndex] = useState<number | null>(null);
  const [successIndex, setSuccessIndex] = useState<number | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Error feedback ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      // Shake all boxes
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      // Clear input on error
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
        clearError();
      }, 2000);
    }
  }, [error]);

  // ── Auto-submit when all digits filled ─────────────────────────────────────
  const allFilled = digits.every((d) => d !== '');
  useEffect(() => {
    if (allFilled && !isLoading) {
      const code = digits.join('');
      // Small delay for visual feedback before submitting
      setTimeout(() => confirmOTP(code), 300);
    }
  }, [allFilled]);

  // ── Handle digit input ─────────────────────────────────────────────────────
  const handleDigitChange = useCallback((text: string, index: number) => {
    const val = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    // Animate this box on fill
    if (val && index < OTP_LENGTH - 1) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
    }
  }, [digits]);

  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace') {
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  }, [digits]);

  // ── Handle paste (auto-fill all boxes) ────────────────────────────────────
  const handlePaste = useCallback((text: string) => {
    const nums = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    if (nums.length === OTP_LENGTH) {
      const newDigits = nums.split('');
      setDigits(newDigits);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  }, []);

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setIsResending(true);
    setCanResend(false);
    setCountdown(60);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    const newTimer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(newTimer); setCanResend(true); return 0; }
        return c - 1;
      });
    }, 1000);

    await resendOTP();
    setIsResending(false);
  };

  // ── Manual verify ──────────────────────────────────────────────────────────
  const handleVerify = () => {
    if (!allFilled) return;
    confirmOTP(digits.join(''));
  };

  // Masked phone display
  const maskedPhone = pendingPhone.replace(/(\+251)(\d{3})(\d{3,})(\d{4})/, '$1 $2-***-$4');

  const getBoxStyle = (index: number) => {
    const isFilled = digits[index] !== '';
    const isActive = !isFilled && index === digits.findIndex((d) => d === '');
    const hasError = !!error;
    return [
      styles.digitBox,
      isFilled && styles.digitBoxFilled,
      isActive && styles.digitBoxActive,
      hasError && isFilled && styles.digitBoxError,
    ];
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#0F1115', '#170E25', '#0F1115']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowPurple} />
      <View style={styles.glowGold} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>

          {/* ── Back Button ── */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goToLogin}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* ── Header ── */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#7B3CB3', '#5B2C83']}
              style={styles.shieldBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="shield-checkmark" size={38} color="#fff" />
            </LinearGradient>

            <H2 style={styles.title}>Verify Your Number</H2>
            <Body align="center" color={Colors.textSecondary} style={styles.subtitle}>
              We sent a 6-digit SMS code to
            </Body>
            <View style={styles.phoneChip}>
              <Ionicons name="phone-portrait-outline" size={14} color={Colors.secondary} />
              <Body style={styles.phoneNumber}>{maskedPhone}</Body>
              <TouchableOpacity onPress={goToLogin} activeOpacity={0.7}>
                <Caption style={styles.changeLink}>Change</Caption>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── OTP Digit Boxes ── */}
          <Animated.View
            style={[
              styles.otpRow,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(r) => { inputRefs.current[index] = r; }}
                style={getBoxStyle(index) as any}
                value={digit}
                onChangeText={(t) => {
                  clearError();
                  if (t.length > 1) {
                    handlePaste(t);
                  } else {
                    handleDigitChange(t, index);
                  }
                }}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH} // Allows paste of full code
                textAlign="center"
                selectionColor={Colors.secondary}
                autoFocus={index === 0}
                editable={!isLoading}
              />
            ))}
          </Animated.View>

          {/* ── Error Message ── */}
          {error && (
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle" size={14} color={Colors.danger} />
              <Caption style={styles.errorText}>{error}</Caption>
            </View>
          )}

          {/* ── Countdown / Resend ── */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending}
                activeOpacity={0.7}
                style={styles.resendBtn}
              >
                <Ionicons name="refresh" size={14} color={Colors.secondary} />
                <Caption style={styles.resendLink}>
                  {isResending ? 'Sending...' : 'Resend Code'}
                </Caption>
              </TouchableOpacity>
            ) : (
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Caption color={Colors.textMuted}>
                  {' '}Resend in{' '}
                  <Caption style={styles.countdownNum}>{countdown}s</Caption>
                </Caption>
              </View>
            )}
          </View>

          {/* ── Verify Button ── */}
          <GradientButton
            title={isLoading ? 'Verifying...' : 'Verify & Enter Wallet'}
            onPress={handleVerify}
            variant={allFilled ? 'gold' : 'outline'}
            size="lg"
            loading={isLoading}
            disabled={!allFilled || isLoading}
            style={styles.verifyBtn}
          />

          {/* ── Security note ── */}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
            <Caption color={Colors.textMuted} style={styles.securityText}>
              {' '}256-bit encrypted · Code expires in 5 minutes · Never share your code
            </Caption>
          </View>

        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  glowPurple: {
    position: 'absolute', top: 80, alignSelf: 'center',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(91,44,131,0.08)',
  },
  glowGold: {
    position: 'absolute', bottom: 60, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(245,176,65,0.04)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  shieldBg: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  title: { marginBottom: 10 },
  subtitle: { lineHeight: 22, marginBottom: 12 },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    gap: 6,
  },
  phoneNumber: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
    fontSize: Typography.size.sm,
  },
  changeLink: {
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  digitBox: {
    flex: 1,
    aspectRatio: 0.82,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    ...Shadows.sm,
  },
  digitBoxActive: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(245,176,65,0.04)',
  },
  digitBoxFilled: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(52,199,89,0.06)',
    color: Colors.success,
  },
  digitBoxError: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(255,59,48,0.06)',
    color: Colors.danger,
  },
  // Error
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    color: Colors.danger,
    fontWeight: Typography.weight.medium,
  },
  // Resend / countdown
  resendRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendLink: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
    fontSize: Typography.size.base,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownNum: {
    color: Colors.secondary,
    fontWeight: Typography.weight.bold,
  },
  verifyBtn: {},
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  securityText: {
    lineHeight: 18,
    flex: 1,
  },
});
