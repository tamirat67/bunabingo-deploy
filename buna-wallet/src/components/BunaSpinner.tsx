/**
 * BunaSpinner — Premium Buna Wallet Circular Loading Spinner
 *
 * Features:
 *   - Three concentric animated rings (Gold outer, Espresso mid, Gold inner)
 *   - Counter-rotating rings for a dynamic, premium effect
 *   - Buna Wallet icon.png in the center
 *   - Pulsing glow animation synced to the spinning
 *   - Fully configurable size (sm | md | lg | xl)
 *   - Optional label text below
 *
 * Usage:
 *   <BunaSpinner size="lg" label="Processing..." />
 *   <BunaSpinner size="md" />          // icon only, no label
 *   <BunaSpinner size="sm" standalone={false} />  // inline (no padding)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { Colors } from '../theme/colors';

// ─── Size Presets ─────────────────────────────────────────────────────────────
const SIZE_MAP = {
  sm: { outer: 56,  mid: 44,  inner: 32, logo: 20, border: 2,   label: 11 },
  md: { outer: 76,  mid: 60,  inner: 44, logo: 28, border: 2.5, label: 13 },
  lg: { outer: 104, mid: 82,  inner: 60, logo: 38, border: 3,   label: 15 },
  xl: { outer: 130, mid: 104, inner: 76, logo: 48, border: 3.5, label: 16 },
};

export type BunaSpinnerSize = keyof typeof SIZE_MAP;

export interface BunaSpinnerProps {
  size?: BunaSpinnerSize;
  label?: string;
  standalone?: boolean; // adds outer padding (true by default)
}

// ─── Spinning Ring ─────────────────────────────────────────────────────────────
const Ring: React.FC<{
  diameter: number;
  borderWidth: number;
  color: string;
  dashColor: string;
  duration: number;
  reverse?: boolean;
}> = ({ diameter, borderWidth, color, dashColor, duration, reverse = false }) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });

  const radius = diameter / 2;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: diameter,
          height: diameter,
          borderRadius: radius,
          borderWidth,
          // Split border: visible arc on one side, transparent on others
          borderTopColor: color,
          borderRightColor: color,
          borderBottomColor: dashColor,
          borderLeftColor: dashColor,
          transform: [{ rotate }],
          position: 'absolute',
        },
      ]}
    />
  );
};

// ─── Pulse Ring ───────────────────────────────────────────────────────────────
const PulseRing: React.FC<{ diameter: number }> = ({ diameter }) => {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderColor: Colors.secondary,
          opacity: pulse,
          transform: [{ scale: pulse }],
        },
      ]}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const BunaSpinner: React.FC<BunaSpinnerProps> = ({
  size = 'lg',
  label,
  standalone = true,
}) => {
  const cfg = SIZE_MAP[size];
  const logoFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.wrapper, standalone && styles.wrapperPadded]}>
      {/* ── Ring Stack ── */}
      <View
        style={[
          styles.ringStack,
          { width: cfg.outer, height: cfg.outer },
        ]}
      >
        {/* Pulse glow behind everything */}
        <PulseRing diameter={cfg.outer + 12} />

        {/* Outer ring — Gold, clockwise, fast */}
        <Ring
          diameter={cfg.outer}
          borderWidth={cfg.border}
          color={Colors.secondary}           // Gold
          dashColor="rgba(212,175,55,0.15)"
          duration={1000}
          reverse={false}
        />

        {/* Mid ring — Espresso, counter-clockwise, medium */}
        <Ring
          diameter={cfg.mid}
          borderWidth={cfg.border}
          color={Colors.primary}             // Espresso
          dashColor="rgba(62,39,35,0.15)"
          duration={1400}
          reverse={true}
        />

        {/* Inner ring — Soft Gold, clockwise, slow */}
        <Ring
          diameter={cfg.inner}
          borderWidth={cfg.border - 0.5}
          color={Colors.secondaryLight}      // Soft Light Gold
          dashColor="rgba(244,224,165,0.2)"
          duration={1900}
          reverse={false}
        />

        {/* Center logo */}
        <Animated.View
          style={[
            styles.centerLogo,
            {
              width: cfg.logo + 14,
              height: cfg.logo + 14,
              borderRadius: (cfg.logo + 14) / 2,
              opacity: logoFadeAnim,
            },
          ]}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: cfg.logo, height: cfg.logo }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* ── Label ── */}
      {label && (
        <Text style={[styles.label, { fontSize: cfg.label }]}>{label}</Text>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperPadded: {
    paddingVertical: 16,
  },
  ringStack: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  centerLogo: {
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.25)',
    // Subtle shadow for depth
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    marginTop: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
