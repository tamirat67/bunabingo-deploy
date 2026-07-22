import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

export interface ChangePinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'current' | 'new' | 'confirm';

const PIN_LENGTH = 4;

export const ChangePinModal: React.FC<ChangePinModalProps> = ({ visible, onClose, onSuccess }) => {
  const { changePin } = useAuth();
  
  const [step, setStep] = useState<Step>('current');
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [currentPinCache, setCurrentPinCache] = useState('');
  const [newPinCache, setNewPinCache] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStep('current');
      setDigits(Array(PIN_LENGTH).fill(''));
      setCurrentPinCache('');
      setNewPinCache('');
      setErrorMsg('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [visible]);

  // Handle errors with shake animation
  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    setDigits(Array(PIN_LENGTH).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleDigitChange = (text: string, index: number) => {
    setErrorMsg('');
    const val = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    if (val && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
    }
  };

  // Auto-submit when all 4 digits are filled
  useEffect(() => {
    const allFilled = digits.every((d) => d !== '');
    if (allFilled) {
      handleStepSubmit();
    }
  }, [digits]);

  const handleStepSubmit = async () => {
    const pin = digits.join('');
    if (pin.length < 4) return;

    if (step === 'current') {
      setCurrentPinCache(pin);
      setDigits(Array(PIN_LENGTH).fill(''));
      setStep('new');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } 
    else if (step === 'new') {
      if (pin === currentPinCache) {
        triggerError('New PIN must be different from current PIN');
        return;
      }
      setNewPinCache(pin);
      setDigits(Array(PIN_LENGTH).fill(''));
      setStep('confirm');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } 
    else if (step === 'confirm') {
      if (pin !== newPinCache) {
        triggerError('PINs do not match. Try again.');
        return;
      }

      // Execute API Call
      setLoading(true);
      try {
        await changePin(currentPinCache, newPinCache);
        onSuccess();
        onClose();
      } catch (err: any) {
        triggerError(err.message || 'Failed to change PIN');
        // If it's a "current PIN incorrect" error, send them back to start
        if (err.message?.toLowerCase().includes('current')) {
          setStep('current');
          setCurrentPinCache('');
          setNewPinCache('');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const getTitle = () => {
    if (step === 'current') return 'Enter Current PIN';
    if (step === 'new') return 'Enter New PIN';
    return 'Confirm New PIN';
  };

  const getSubtitle = () => {
    if (step === 'current') return 'To change your PIN, please verify your current 4-digit PIN.';
    if (step === 'new') return 'Enter a new 4-digit PIN for your wallet.';
    return 'Please re-enter your new 4-digit PIN to confirm.';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>{getTitle()}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {/* PIN Input */}
          <View style={styles.pinSection}>
            <Animated.View style={[styles.boxesContainer, { transform: [{ translateX: shakeAnim }] }]}>
              {digits.map((digit, index) => (
                <View
                  key={`pin-${index}`}
                  style={[
                    styles.digitBox,
                    digit ? styles.digitBoxFilled : null,
                    errorMsg ? styles.digitBoxError : null,
                  ]}
                >
                  <TextInput
                    ref={(el: any) => (inputRefs.current[index] = el)}
                    style={styles.hiddenInput}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(t) => handleDigitChange(t, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    secureTextEntry
                  />
                  <Text style={styles.digitText}>
                    {digit ? '●' : '*'}
                  </Text>
                </View>
              ))}
            </Animated.View>
            
            <View style={styles.errorContainer}>
              {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
            </View>
          </View>

          {/* Loading Overlay inside the sheet */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.secondary} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,10,5,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
    ...(Shadows.espresso as any),
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  boxesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  digitBox: {
    width: 60,
    height: 70,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#F8F8F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Shadows.sm as any),
  },
  digitBoxFilled: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  digitBoxError: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.05)',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    fontSize: 24,
    textAlign: 'center',
  },
  digitText: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '700',
  },
  errorContainer: {
    height: 24,
    marginTop: 12,
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
    zIndex: 10,
  },
});
