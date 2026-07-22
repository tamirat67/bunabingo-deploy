import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';

const GOLD = Colors.secondary;
const GOLD_DARK = Colors.primary;
const TEXT_DARK = Colors.textPrimary;
const TEXT_MUTED = Colors.textSecondary;
const BG_WHITE = Colors.background;

export const BiometricSetupScreen: React.FC = () => {
  const { enableBiometrics, skipBiometrics } = useAuth();
  const [isCompatible, setIsCompatible] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsCompatible(compatible && enrolled);
    })();
  }, []);

  const handleEnable = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Scan Fingerprint to Authenticate',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await enableBiometrics();
      } else if (result.error !== 'user_cancel') {
        Alert.alert('Authentication Failed', 'We could not verify your biometrics.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  if (!isCompatible) {
    // If device doesn't support biometrics, just skip
    skipBiometrics();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brandName}>Buna Wallet</Text>
        <Text style={styles.title}>Secure Your{' \n'}Account</Text>
        <Text style={styles.subtitle}>
          Enable fingerprint authentication for faster and more secure logins.
        </Text>
      </View>

      <View style={styles.imageContainer}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.iconImage}
          resizeMode="contain"
        />
        <View style={styles.fingerprintBadge}>
          <Text style={styles.fingerprintIcon}>👆</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.enableBtn} onPress={handleEnable} activeOpacity={0.85}>
          <Text style={styles.enableBtnText}>Enable Fingerprint</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.skipBtn} onPress={skipBiometrics} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_WHITE,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 40,
  },
  iconImage: {
    width: 200,
    height: 200,
    borderRadius: 40,
  },
  fingerprintBadge: {
    position: 'absolute',
    bottom: -15,
    right: 80,
    backgroundColor: '#FFF',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fingerprintIcon: {
    fontSize: 32,
  },
  footer: {
    width: '100%',
    paddingBottom: 20,
  },
  enableBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 16,
  },
  enableBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
  },
  skipBtn: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
});
