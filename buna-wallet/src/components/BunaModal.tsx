/**
 * BunaModal — Premium Buna Wallet Modal / Popup Component
 *
 * Variants:
 *   'success'  — Green check icon, gold accent
 *   'error'    — Red X icon, danger styling
 *   'warning'  — Amber warning icon
 *   'info'     — Blue info icon
 *   'confirm'  — Two action buttons (cancel / confirm)
 *   'loading'  — Spinner, non-dismissible
 *   'custom'   — Render any content via `children`
 *
 * Usage:
 *   <BunaModal
 *     visible={visible}
 *     variant="success"
 *     title="Transfer Complete!"
 *     message="500 ETB was sent to Dawit."
 *     primaryLabel="Done"
 *     onPrimary={() => setVisible(false)}
 *     onClose={() => setVisible(false)}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';
import { BunaSpinner } from './BunaSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
export type BunaModalVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'confirm'
  | 'loading'
  | 'custom';

export interface BunaModalProps {
  visible: boolean;
  variant?: BunaModalVariant;
  title?: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
  dismissable?: boolean;        // tap backdrop to close (default: true, except loading)
  showLogo?: boolean;           // show Buna Wallet icon at top (default: true)
  children?: React.ReactNode;   // for variant='custom'
}

// ─── Variant Config ───────────────────────────────────────────────────────────
const VARIANT_CONFIG: Record<
  Exclude<BunaModalVariant, 'custom' | 'loading'>,
  { icon: string; iconBg: string; iconColor: string; accentColor: string }
> = {
  success: {
    icon: 'checkmark-circle',
    iconBg: 'rgba(52,199,89,0.12)',
    iconColor: '#34C759',
    accentColor: '#34C759',
  },
  error: {
    icon: 'close-circle',
    iconBg: 'rgba(255,59,48,0.12)',
    iconColor: '#FF3B30',
    accentColor: '#FF3B30',
  },
  warning: {
    icon: 'warning',
    iconBg: 'rgba(255,149,0,0.12)',
    iconColor: '#FF9500',
    accentColor: '#FF9500',
  },
  info: {
    icon: 'information-circle',
    iconBg: 'rgba(10,132,255,0.12)',
    iconColor: '#0A84FF',
    accentColor: '#0A84FF',
  },
  confirm: {
    icon: 'help-circle',
    iconBg: 'rgba(212,175,55,0.15)',
    iconColor: Colors.secondary,
    accentColor: Colors.primary,
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const BunaModal: React.FC<BunaModalProps> = ({
  visible,
  variant = 'info',
  title,
  message,
  primaryLabel = 'OK',
  secondaryLabel = 'Cancel',
  onPrimary,
  onSecondary,
  onClose,
  dismissable = true,
  showLogo = true,
  children,
}) => {
  // ── Animation refs ──
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const isLoading = variant === 'loading';
  const isCustom = variant === 'custom';
  const canDismiss = dismissable && !isLoading;
  const config =
    !isLoading && !isCustom
      ? VARIANT_CONFIG[variant as Exclude<BunaModalVariant, 'custom' | 'loading'>]
      : null;

  const handleBackdropPress = () => {
    if (canDismiss && onClose) onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={canDismiss ? onClose : undefined}
    >
      {/* ── Backdrop ── */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Animated.View style={[styles.backdropInner, { opacity: opacityAnim }]} />
      </Pressable>

      {/* ── Card ── */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Top Gold Accent Bar ── */}
          <LinearGradient
            colors={['#D4AF37', '#B8860B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          {/* ── Header: Logo + close ── */}
          <View style={styles.cardHeader}>
            {showLogo && (
              <Image
                source={require('../../assets/icon.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            )}
            {!isLoading && onClose && canDismiss && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Loading variant ── */}
          {isLoading && (
            <View style={styles.loadingBody}>
              <BunaSpinner size="lg" />
              {title && <Text style={styles.loadingTitle}>{title}</Text>}
              {message && <Text style={styles.loadingMessage}>{message}</Text>}
            </View>
          )}

          {/* ── Custom variant ── */}
          {isCustom && !isLoading && (
            <View style={styles.customBody}>{children}</View>
          )}

          {/* ── Standard variants ── */}
          {!isLoading && !isCustom && config && (
            <View style={styles.body}>
              {/* Variant Icon */}
              <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
                <Ionicons name={config.icon as any} size={44} color={config.iconColor} />
              </View>

              {/* Title */}
              {title && <Text style={styles.title}>{title}</Text>}

              {/* Message */}
              {message && <Text style={styles.message}>{message}</Text>}

              {/* ── Action Buttons ── */}
              <View style={[
                styles.actions,
                variant === 'confirm' && styles.actionsRow,
              ]}>
                {/* Secondary (cancel / left) */}
                {variant === 'confirm' && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={onSecondary ?? onClose}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
                  </TouchableOpacity>
                )}

                {/* Primary button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    variant === 'confirm' && styles.primaryBtnFlex,
                  ]}
                  onPress={onPrimary ?? onClose}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      variant === 'error'
                        ? ['#FF3B30', '#CC2E25']
                        : variant === 'success'
                        ? ['#34C759', '#28A347']
                        : variant === 'warning'
                        ? ['#FF9500', '#E08800']
                        : Colors.espressoGradient as any
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Bottom brand tag ── */}
          <View style={styles.brandTag}>
            <Text style={styles.brandTagText}>BUNA WALLET</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  backdropInner: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20,10,5,0.65)',
  },
  centeredContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 24,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 28,
    overflow: 'hidden',
    ...(Shadows.espresso as any),
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  brandLogo: {
    width: 44,
    height: 44,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  actions: {
    width: '100%',
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    ...(Shadows.card as any),
  },
  primaryBtnFlex: {
    flex: 1,
    width: undefined,
  },
  primaryBtnGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    marginBottom: 10,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  loadingBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  customBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  brandTag: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 2.5,
  },
});
