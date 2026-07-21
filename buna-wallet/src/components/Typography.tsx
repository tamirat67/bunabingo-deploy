import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Colors, Typography } from '../theme';

interface TypographyProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  color?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
}

export const H1: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.h1, { color: color ?? Colors.textPrimary, textAlign: align }, style]}>
    {children}
  </Text>
);

export const H2: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.h2, { color: color ?? Colors.textPrimary, textAlign: align }, style]}>
    {children}
  </Text>
);

export const H3: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.h3, { color: color ?? Colors.textPrimary, textAlign: align }, style]}>
    {children}
  </Text>
);

export const BodyLarge: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.bodyLarge, { color: color ?? Colors.textPrimary, textAlign: align }, style]}>
    {children}
  </Text>
);

export const Body: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.body, { color: color ?? Colors.textSecondary, textAlign: align }, style]}>
    {children}
  </Text>
);

export const Caption: React.FC<TypographyProps> = ({ children, style, color, align = 'left', numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.caption, { color: color ?? Colors.textMuted, textAlign: align }, style]}>
    {children}
  </Text>
);

export const Label: React.FC<TypographyProps> = ({ children, style, color, align = 'left' }) => (
  <Text style={[styles.label, { color: color ?? Colors.textMuted, textAlign: align }, style]}>
    {children}
  </Text>
);

export const Amount: React.FC<TypographyProps & { size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({
  children, style, color, align = 'left', size = 'lg'
}) => {
  const fontSize = {
    sm: Typography.size.xl,
    md: Typography.size['2xl'],
    lg: Typography.size['3xl'],
    xl: Typography.size['4xl'],
  }[size];
  return (
    <Text style={[styles.amount, { fontSize, color: color ?? Colors.textPrimary, textAlign: align }, style]}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.extraBold,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.semiBold,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.size.md * 1.5,
  },
  body: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.size.base * 1.5,
  },
  caption: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.size.sm * 1.5,
  },
  label: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  amount: {
    fontWeight: Typography.weight.extraBold,
    letterSpacing: -1,
  },
});
