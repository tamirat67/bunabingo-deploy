import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors, BorderRadius, Shadows } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'flat' | 'gold' | 'purple';
  padding?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 20,
}) => {
  const variantStyle = {
    default: styles.default,
    elevated: styles.elevated,
    flat: styles.flat,
    gold: styles.gold,
    purple: styles.purple,
  }[variant];

  return (
    <View style={[styles.base, variantStyle, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  default: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassStroke,
    ...Shadows.md,
  },
  elevated: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.lg,
  },
  flat: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 0,
  },
  gold: {
    backgroundColor: 'rgba(245, 176, 65, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 176, 65, 0.25)',
    ...Shadows.gold,
  },
  purple: {
    backgroundColor: 'rgba(91, 44, 131, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91, 44, 131, 0.3)',
    ...Shadows.purple,
  },
});
