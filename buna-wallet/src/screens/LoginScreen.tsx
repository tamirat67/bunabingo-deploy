import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Alert,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows } from '../theme';
import { GradientButton } from '../components/GradientButton';
import { H2, Body, Caption, Label } from '../components/Typography';
import { useAuth } from '../context/AuthContext';
import { pollTelegramAuth } from '../services/authService';

export const LoginScreen: React.FC = () => {
  const { requestOTP, startTelegramAuth, isLoading, error, clearError } = useAuth();

  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);
  const [shakeAnim] = useState(new Animated.Value(0));

  // Show error as alert + shake input
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      Alert.alert('Invalid Number', 'Please enter a valid 9-digit Ethiopian phone number.');
      return;
    }
    await requestOTP(phone);
  };

  const handleTelegramAuth = async () => {
    try {
      const sessionId = await startTelegramAuth();
      
      // Open the Telegram Deep Link to Buna Bingo Bot
      const botUsername = 'BunaBingoBot';
      const telegramUrl = `https://t.me/${botUsername}?start=auth_${sessionId}`;
      await Linking.openURL(telegramUrl);

      // Start Polling Loop
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes (60 * 2s)
      
      const poll = async () => {
        if (attempts >= maxAttempts) {
          Alert.alert('Timeout', 'Telegram authentication timed out. Please try again.');
          return;
        }
        
        try {
          const res = await pollTelegramAuth(sessionId);
          if (res.status === 'pending') {
            attempts++;
            setTimeout(poll, 2000); // Check again in 2 seconds
          } else if (res.success && res.token) {
            Alert.alert('Success', 'Logged in via Telegram successfully!');
            // Here you'd call confirmOTP or a dedicated finalizeTelegramAuth in AuthContext
            // For now we just alert, you'd integrate this to set the AuthUser.
          }
        } catch (err) {
          // Keep polling unless it's a hard fail
          attempts++;
          setTimeout(poll, 2000);
        }
      };
      
      poll();
      
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open Telegram');
    }
  };

  const isValid = phone.replace(/\D/g, '').length >= 9;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#0F1115', '#1A1520', '#0F1115']}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glows */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={styles.header}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />

            <H2 style={styles.title}>Welcome to Buna Wallet</H2>
            <Body align="center" color={Colors.textSecondary} style={styles.subtitle}>
              Enter your Ethiopian phone number to{'\n'}receive a one-time verification code
            </Body>
          </View>

          {/* ── Phone Input Card ── */}
          <View style={styles.card}>
            <Label style={styles.fieldLabel}>Phone Number</Label>

            <Animated.View
              style={[
                styles.inputRow,
                focused && styles.inputRowFocused,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {/* Country prefix */}
              <View style={styles.prefix}>
                <Caption style={styles.flag}>🇪🇹</Caption>
                <Body style={styles.prefixCode} color={Colors.textSecondary}>+251</Body>
                <View style={styles.prefixDivider} />
              </View>

              {/* Number field */}
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(t) => {
                  clearError();
                  setPhone(t);
                }}
                placeholder="9XX XXX XXXX"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={12}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                returnKeyType="send"
                onSubmitEditing={handleSendOTP}
                autoFocus
              />

              {/* Clear button */}
              {phone.length > 0 && (
                <TouchableOpacity
                  onPress={() => setPhone('')}
                  style={styles.clearBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Helper text */}
            <Caption color={Colors.textMuted} style={styles.helperText}>
              📱 You'll receive an SMS with your 6-digit code via Telerivet
            </Caption>

            {/* CTA */}
            <GradientButton
              title={isLoading ? 'Sending...' : 'Send Verification Code'}
              onPress={handleSendOTP}
              variant="gold"
              size="lg"
              loading={isLoading}
              disabled={!isValid || isLoading}
              style={styles.ctaBtn}
            />

            {/* Divider */}
            <View style={styles.orRow}>
              <View style={styles.line} />
              <Caption style={styles.orLabel}>or sign in with</Caption>
              <View style={styles.line} />
            </View>

            {/* Telegram option */}
            <TouchableOpacity 
              style={styles.telegramBtn} 
              activeOpacity={0.75}
              onPress={handleTelegramAuth}
            >
              <Ionicons name="paper-plane" size={20} color="#26A5E4" />
              <Body style={styles.telegramText} color={Colors.textPrimary}>
                Continue with Telegram
              </Body>
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Caption color={Colors.textMuted}>New to Buna Wallet? </Caption>
            <TouchableOpacity activeOpacity={0.7}>
              <Caption style={styles.signUpLink}>Create Account</Caption>
            </TouchableOpacity>
          </View>

          <Caption align="center" color={Colors.textMuted} style={styles.terms}>
            By continuing you agree to our{' '}
            <Caption style={styles.link}>Terms of Service</Caption>
            {' & '}
            <Caption style={styles.link}>Privacy Policy</Caption>
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  glowTopRight: {
    position: 'absolute', top: -60, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(245,176,65,0.05)',
  },
  glowBottomLeft: {
    position: 'absolute', bottom: -50, left: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(91,44,131,0.06)',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 120, 
    height: 120,
    marginBottom: 8,
  },
  title: { marginBottom: 10, textAlign: 'center' },
  subtitle: { lineHeight: 22 },
  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.lg,
    marginBottom: 24,
  },
  fieldLabel: { marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  inputRowFocused: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(245,176,65,0.03)',
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 0,
    paddingVertical: 16,
  },
  flag: { fontSize: 20, marginRight: 6 },
  prefixCode: {
    fontWeight: Typography.weight.semiBold,
    fontSize: Typography.size.base,
  },
  prefixDivider: {
    width: 1, height: 20,
    backgroundColor: Colors.border,
    marginLeft: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
    paddingVertical: 16,
    paddingLeft: 12,
  },
  clearBtn: { paddingHorizontal: 14 },
  helperText: { marginBottom: 20, lineHeight: 18 },
  ctaBtn: {},
  orRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 18,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orLabel: { marginHorizontal: 12, color: Colors.textMuted },
  telegramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    gap: 10,
  },
  telegramText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semiBold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
  },
  signUpLink: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
  },
  terms: { paddingHorizontal: 16, lineHeight: 18 },
  link: { color: Colors.secondary },
});
