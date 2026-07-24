import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';
import { BunaModal } from '../components/BunaModal';

const PIN_LENGTH = 4;

export const PINScreen: React.FC = () => {
  const { step, pendingPhone, verifyPin, setupPin, requestOTP, isLoading, error, clearError, isBiometricEnabled, biometricVerify, switchAccount } = useAuth();
  const isSetup = step === 'pin_setup';

  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // BunaModal states
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState('');
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  const handleBiometricAuth = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Scan Fingerprint to Authenticate',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await biometricVerify();
      }
    } catch (e) {
      console.error(e);
    }
  }, [biometricVerify]);

  useEffect(() => {
    if (!isSetup && isBiometricEnabled) {
      handleBiometricAuth();
    }
  }, [isSetup, isBiometricEnabled, handleBiometricAuth]);

  // ── Error Feedback ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      setErrorModalMsg(error);
      setErrorModalVisible(true);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      setDigits(Array(PIN_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [error]);

  // ── Handle Input ───────────────────────────────────────────────────────────
  const handleDigitChange = useCallback((text: string, index: number) => {
    const val = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    if (val && index < PIN_LENGTH - 1) {
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
        inputRefs.current[index - 1]?.focus();
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
    }
  }, [digits]);

  // ── Submission ─────────────────────────────────────────────────────────────
  const allFilled = digits.every((d) => d !== '');
  
  const handleSubmit = async () => {
    if (!allFilled) return;
    const pin = digits.join('');
    if (isSetup) {
      await setupPin(pin);
    } else {
      await verifyPin(pin);
    }
  };

  const handleForgotPin = () => {
    setForgotModalVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Premium Light Header Card */}
      <View style={styles.lightHeaderCard}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitleDark}>
          {isSetup ? `Create Your\nPincode` : `Login with Your\nPincode`}
        </Text>
        <Text style={styles.headerSubtitleDark}>
          {isSetup 
            ? 'Create a secure 4-digit pincode for future logins.'
            : 'Insert the 4 digit pincode you provided.'}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Phone display for Login */}
        {!isSetup && (
          <View style={styles.phoneSection}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.phoneInputBox}>
              <Text style={styles.phoneInputText}>{pendingPhone || '+251 000 000 000'}</Text>
            </View>
          </View>
        )}

        {/* PIN Input Section */}
        <View style={styles.pinSection}>
          <Text style={styles.fieldLabel}>Pin code</Text>
          <Animated.View style={[styles.boxesContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {digits.map((digit, index) => (
              <View
                key={`pin-${index}`}
                style={[
                  styles.digitBox,
                  digit ? styles.digitBoxFilled : null,
                ]}
              >
                <TextInput
                  ref={(el) => { inputRefs.current[index] = el; }}
                  style={styles.hiddenInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(t) => handleDigitChange(t, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  secureTextEntry
                  autoFocus={index === 0}
                />
                <Text style={styles.digitText}>
                  {digit ? '●' : '*'}
                </Text>
              </View>
            ))}
          </Animated.View>

          {!isSetup && (
            <View style={styles.actionRow}>
              {isBiometricEnabled ? (
                <TouchableOpacity onPress={handleBiometricAuth} style={styles.fingerprintBtn}>
                  <Ionicons name="finger-print" size={32} color={Colors.primary} />
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={handleForgotPin} activeOpacity={0.7} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot PIN?</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.spacer} />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.continueBtn, !allFilled && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!allFilled || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.continueBtnRow}>
              <Text style={styles.continueBtnText}>{isSetup ? 'Set PIN' : 'Next'}</Text>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Switch Account */}
        {!isSetup && (
          <TouchableOpacity onPress={switchAccount} style={styles.switchAccountBtn}>
            <Text style={styles.switchAccountText}>Not you? Switch Account</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>

    {/* ── Error Modal ── */}
    <BunaModal
      visible={errorModalVisible}
      variant="error"
      title="Incorrect PIN"
      message={errorModalMsg}
      primaryLabel="Try Again"
      onPrimary={() => { setErrorModalVisible(false); clearError(); }}
      onClose={() => { setErrorModalVisible(false); clearError(); }}
    />

    {/* ── Forgot PIN Modal ── */}
    <BunaModal
      visible={forgotModalVisible}
      variant="confirm"
      title="Reset PIN"
      message="We will send an OTP to your phone to verify your identity and reset your PIN."
      primaryLabel="Send OTP"
      secondaryLabel="Cancel"
      onPrimary={() => { setForgotModalVisible(false); requestOTP(pendingPhone); }}
      onSecondary={() => setForgotModalVisible(false)}
      onClose={() => setForgotModalVisible(false)}
    />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  lightHeaderCard: {
    backgroundColor: Colors.background,
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 28,
    alignItems: 'flex-start',
  },
  headerLogo: {
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  headerTitleDark: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 34,
  },
  headerSubtitleDark: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },
  phoneSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  phoneInputBox: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
  },
  phoneInputText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pinSection: {
    marginTop: 10,
  },
  boxesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
  },
  digitBox: {
    width: 50,
    height: 56,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Shadows.sm as any),
  },
  digitBoxFilled: {
    borderColor: Colors.secondary,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    fontSize: 1,
  },
  digitText: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  fingerprintBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundAlt,
    ...(Shadows.sm as any),
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondaryDark,
  },
  switchAccountBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Shadows.card as any),
  },
  continueBtnDisabled: {
    backgroundColor: Colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  continueBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondaryLight,
    marginRight: 10,
  },
});
