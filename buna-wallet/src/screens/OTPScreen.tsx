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
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';

const OTP_LENGTH = 6;

export const OTPScreen: React.FC = () => {
  const { pendingPhone, confirmOTP, resendOTP, isLoading, error, clearError } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
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
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [error]);

  // ── Auto-submit when all digits filled ─────────────────────────────────────
  const allFilled = digits.every((d) => d !== '');
  useEffect(() => {
    if (allFilled && !isLoading) {
      const code = digits.join('');
      setTimeout(() => confirmOTP(code), 300);
    }
  }, [allFilled]);

  // ── Handle Input ───────────────────────────────────────────────────────────
  const handleDigitChange = useCallback((text: string, index: number) => {
    const val = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

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
        inputRefs.current[index - 1]?.focus();
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
    }
  }, [digits]);

  const handleResend = async () => {
    Alert.alert('Resend OTP', 'A new verification code will be sent to your number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: resendOTP },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primary }}><KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Gold Header Card */}
      <View style={styles.goldHeaderCard}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Verify Your{'\n'}Phone Number</Text>
        <Text style={styles.headerSubtitle}>
          We sent a verification code to the phone number you provided.
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            We sent a code to <Text style={styles.phoneBold}>{pendingPhone || '+251 000 000 000'}</Text>
          </Text>
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't recieve the code? </Text>
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.resendLink}>Send again</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OTP Input Section */}
        <Animated.View style={[styles.boxesContainer, { transform: [{ translateX: shakeAnim }] }]}>
          {digits.map((digit, index) => (
            <View
              key={`otp-${index}`}
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
                autoFocus={index === 0}
              />
              <Text style={styles.digitText}>
                {digit ? '*' : '*'}
              </Text>
            </View>
          ))}
        </Animated.View>

        {isLoading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

      </View>
    </KeyboardAvoidingView></SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  goldHeaderCard: {
    backgroundColor: Colors.primary,
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 55,
  },
  headerLogo: {
    width: 68,
    height: 68,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.secondary,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.secondaryLight,
    marginTop: 10,
    lineHeight: 20,
    paddingRight: 20,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  infoRow: {
    marginBottom: 30,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  phoneBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondaryDark,
  },
  boxesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  digitBox: {
    width: 44,
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
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
    fontSize: 20,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 6, // alignment for asterisk
  },
  loadingWrapper: {
    marginTop: 40,
    alignItems: 'center',
  },
});
