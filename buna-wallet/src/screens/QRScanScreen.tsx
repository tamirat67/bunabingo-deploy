import React from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../theme';
import { H2, Body, Caption } from '../components/Typography';

export const QRScanScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Fake Camera View */}
      <View style={styles.cameraView}>
        <View style={styles.scanBox}>
          {/* Scanner corners */}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          
          <LinearGradient
            colors={['rgba(245,176,65,0.5)', 'transparent']}
            style={styles.scanLine}
          />
        </View>
      </View>

      <LinearGradient colors={['transparent', '#0F1115', '#0F1115']} style={styles.bottomOverlay}>
        <H2 style={styles.title}>Scan to Pay</H2>
        <Body align="center" color={Colors.textSecondary} style={styles.subtitle}>
          Align QR code within the frame to pay merchants or transfer to friends
        </Body>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.iconCircle}>
              <Ionicons name="images" size={24} color="#fff" />
            </View>
            <Caption>Upload Image</Caption>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.iconCircle}>
              <Ionicons name="qr-code" size={24} color="#fff" />
            </View>
            <Caption>My QR Code</Caption>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanBox: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: Colors.secondary, borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  scanLine: { width: '100%', height: 100, position: 'absolute', top: 0 },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 350, paddingHorizontal: 24, paddingBottom: 100, alignItems: 'center', justifyContent: 'flex-end' },
  title: { marginBottom: 12 },
  subtitle: { marginBottom: 32, paddingHorizontal: 20 },
  actions: { flexDirection: 'row', gap: 32 },
  actionBtn: { alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});
