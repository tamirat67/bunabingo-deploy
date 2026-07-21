import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius, Shadows, Spacing } from '../theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'gold' | 'brown' | 'purple' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const GRADIENTS = {
  gold: ['#F5B041', '#E67E22'] as [string, string],
  brown: ['#6B3E2A', '#4B2E1F'] as [string, string],
  purple: ['#7B3CB3', '#5B2C83'] as [string, string],
  danger: ['#FF6B6B', '#FF3B30'] as [string, string],
  outline: ['transparent', 'transparent'] as [string, string],
  ghost: ['transparent', 'transparent'] as [string, string],
};

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  variant = 'gold',
  size = 'md',
  style,
  textStyle,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
}) => {
  const sizeStyle = {
    sm: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.md },
    md: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: BorderRadius.lg },
    lg: { paddingVertical: 18, paddingHorizontal: 32, borderRadius: BorderRadius.xl },
  }[size];

  const textSizeStyle = {
    sm: { fontSize: Typography.size.sm },
    md: { fontSize: Typography.size.base },
    lg: { fontSize: Typography.size.md },
  }[size];

  const shadowStyle = variant === 'gold'
    ? Shadows.gold
    : variant === 'purple'
    ? Shadows.purple
    : Shadows.md;

  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const needsBorder = isOutline;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        fullWidth && styles.fullWidth,
        shadowStyle,
        style,
        disabled && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          sizeStyle,
          needsBorder && styles.outlineBorder,
          isGhost && styles.ghostStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={isOutline || isGhost ? Colors.secondary : '#fff'}
            size="small"
          />
        ) : (
          <View style={styles.row}>
            {icon && iconPosition === 'left' && (
              <View style={styles.iconLeft}>{icon}</View>
            )}
            <Text
              style={[
                styles.text,
                textSizeStyle,
                (isOutline || isGhost) && styles.outlineText,
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <View style={styles.iconRight}>{icon}</View>
            )}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: Typography.weight.bold,
    letterSpacing: 0.3,
  },
  outlineText: {
    color: Colors.secondary,
  },
  outlineBorder: {
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  ghostStyle: {
    borderWidth: 0,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
