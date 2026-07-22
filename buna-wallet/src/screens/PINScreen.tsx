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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const PIN_LENGTH = 4;
const GOLD = '#D4AF37';
const GOLD_DARK = '#B8860B';
const TEXT_DARK = '#1C1C1E';
const TEXT_MUTED = '#6E6E73';
const BG_WHITE = '#FFFFFF';

export const PINScreen: React.FC = () => {
  const { step, pendingPhone, verifyPin, setupPin, requestOTP, isLoading, error, clearError } = useAuth();
  const isSetup = step === 'pin_setup';

  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Error Feedback ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
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

  const handleForgotPin = async () => {
    Alert.alert(
      'Reset PIN',
      'We will send an OTP to your phone to verify your identity and reset your PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send OTP', 
          onPress: () => {
            requestOTP(pendingPhone);
          }
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BG_WHITE} />

      {/* Premium Light Header Card */}
      <View style={styles.lightHeaderCard}>
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
                  ref={(el) => (inputRefs.current[index] = el)}
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
            <TouchableOpacity onPress={handleForgotPin} activeOpacity={0.7} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot PIN?</Text>
            </TouchableOpacity>
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
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_WHITE,
  },
  lightHeaderCard: {
    backgroundColor: BG_WHITE,
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 28,
  },
  headerTitleDark: {
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_DARK,
    lineHeight: 38,
  },
  headerSubtitleDark: {
    fontSize: 15,
    color: TEXT_MUTED,
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
    color: TEXT_DARK,
    marginBottom: 8,
  },
  phoneInputBox: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  phoneInputText: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_MUTED,
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
    borderWidth: 1,
    borderColor: '#D0D0D5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digitBoxFilled: {
    borderColor: GOLD,
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
    color: TEXT_DARK,
    fontWeight: '700',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 16,
    marginRight: 20,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD_DARK,
  },
  spacer: {
    flex: 1,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E5C158',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: GOLD_DARK,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  continueBtnDisabled: {
    backgroundColor: '#EBE5D3',
    elevation: 0,
  },
  continueBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 10,
  },
});
