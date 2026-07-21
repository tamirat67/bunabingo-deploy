import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../theme';
import { H1, Body, Caption } from '../components/Typography';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(onFinish, 1000);
    });
  }, []);

  return (
    <LinearGradient
      colors={['#0F1115', '#1B1E24', '#0F1115']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background glow */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      {/* Logo Area */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logoImage} 
          resizeMode="contain"
        />
      </Animated.View>

      {/* Brand Name (we can hide the text if the logo image already has "BUNA WALLET" text, but based on your image, it has the text! So we can just use the image for the whole thing and skip the text below) */}


      {/* Tagline */}
      <Animated.View style={{ opacity: taglineOpacity }}>
        <Caption style={styles.tagline}>Pay • Play • Save • Earn</Caption>
      </Animated.View>

      {/* Bottom */}
      <View style={styles.bottom}>
        <Caption style={styles.footerText}>Powered by Buna Ecosystem</Caption>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowTopRight: {
    position: 'absolute',
    top: -50,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(245, 176, 65, 0.06)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(91, 44, 131, 0.07)',
  },
  logoWrapper: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 250,
    height: 250,
  },
  textArea: {
    alignItems: 'center',
    marginBottom: 12,
    display: 'none', // Hidden since logo has text
  },
  brand: {
    fontSize: 38,
    textAlign: 'center',
  },
  brandBuna: {
    color: '#F5B041',
    fontSize: 38,
    fontWeight: '800',
  },
  brandWallet: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(200, 205, 212, 0.7)',
    letterSpacing: 3,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  bottom: {
    position: 'absolute',
    bottom: 48,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(200, 205, 212, 0.35)',
    letterSpacing: 1,
  },
});
