import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';

export const QRScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Animate scan line
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Handle different QR formats
    if (data.startsWith('buna://pay/')) {
      const recipient = data.replace('buna://pay/', '');
      Alert.alert('Pay to Merchant', `Send payment to:\n${recipient}`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
        {
          text: 'Continue',
          onPress: () => {
            navigation.navigate('Transfer');
          },
        },
      ]);
    } else if (data.startsWith('http') || data.startsWith('https')) {
      Alert.alert('Open Link', `Open this URL?\n${data}`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
        { text: 'Open', onPress: () => Linking.openURL(data) },
      ]);
    } else {
      Alert.alert('QR Scanned', `Content:\n${data}`, [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  };

  // ── No permission yet ──────────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.container} />;
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={styles.permContent}>
          <View style={styles.permIconBox}>
            <Ionicons name="camera-outline" size={60} color={Colors.secondary} />
          </View>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSubtitle}>
            Allow camera access to scan QR codes for payments and transfers.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Camera active ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'pdf417', 'aztec', 'ean13', 'ean8'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Dark overlay with transparent scan window */}
      <View style={styles.overlay}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />

        {/* Middle row */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />

          {/* Scan Frame */}
          <View style={styles.scanFrame}>
            {/* Corners */}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />

            {/* Animated scan line */}
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
            />
          </View>

          <View style={styles.overlaySide} />
        </View>

        {/* Bottom dark area */}
        <View style={styles.overlayBottom}>
          <Text style={styles.scanLabel}>Align QR code within the frame</Text>

          {/* Action Row */}
          <View style={styles.actionsRow}>
            {/* Torch */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setTorch(!torch)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, torch && styles.actionIconActive]}>
                <Ionicons name={torch ? 'flash' : 'flash-outline'} size={24} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Flash</Text>
            </TouchableOpacity>

            {/* My QR */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                Alert.alert(
                  'My QR Code',
                  `Wallet: ${user?.walletId || 'N/A'}\nPhone: ${user?.phone || 'N/A'}\n\nShare this with others to receive payments.`
                )
              }
              activeOpacity={0.8}
            >
              <View style={styles.actionIconBox}>
                <Ionicons name="qr-code-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>My QR</Text>
            </TouchableOpacity>

            {/* Rescan if already scanned */}
            {scanned && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setScanned(false)}
                activeOpacity={0.8}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="refresh-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.actionLabel}>Rescan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ── Permission screen ──
  permContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  permIconBox: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  permTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
  },
  permSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  permBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  permBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Camera overlay ──
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: FRAME_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.secondary,
    borderWidth: 3,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: Colors.secondary,
    borderRadius: 1,
    top: '50%',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  overlayBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 90,
  },
  scanLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    marginBottom: 32,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 36,
    alignItems: 'center',
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionIconActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
});
