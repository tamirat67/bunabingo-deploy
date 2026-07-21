import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, TextInput, Alert, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { H2, Body, Caption, Label } from '../components/Typography';
import { requestWithdrawal } from '../services/walletService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type WithdrawScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Withdraw'>;

const PAYMENT_METHODS = [
  { id: 'telebirr', name: 'Telebirr', icon: '📱' },
  { id: 'cbe', name: 'CBE Birr', icon: '🏦' },
  { id: 'mpesa', name: 'M-PESA', icon: '🟢' },
];

export const WithdrawScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<WithdrawScreenNavigationProp>();
  
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }
    if (!accountNumber || accountNumber.trim().length < 9) {
      Alert.alert('Invalid Account', 'Please enter a valid account or phone number.');
      return;
    }
    if (!user?.phone) {
      Alert.alert('Authentication Error', 'Could not verify your user ID. Please log in again.');
      return;
    }

    setIsLoading(true);
    try {
      const methodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod);
      await requestWithdrawal({
        userId: user.phone,
        amount: Number(amount),
        paymentMethod: methodObj?.name || selectedMethod,
        accountNumber: accountNumber.trim(),
      });
      
      Alert.alert(
        'Withdrawal Requested! 💸',
        'Your withdrawal is now pending review. Your balance has been updated.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Withdrawal Failed', err.message || 'Something went wrong. Do you have enough balance?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#1A1225', '#0F1115']} style={styles.bgGrad} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <H2>Withdraw Funds</H2>
          <View style={{ width: 40 }} />
        </View>

        {/* Method Selection */}
        <View style={styles.section}>
          <Label style={styles.inputLabel}>Withdraw To</Label>
          <View style={styles.methodsGrid}>
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedMethod === method.id;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={[styles.methodCard, isSelected && styles.methodCardActive]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={['rgba(245,176,65,0.15)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                      borderRadius={BorderRadius.lg}
                    />
                  )}
                  <Text style={styles.methodIcon}>{method.icon}</Text>
                  <Caption style={[styles.methodName, isSelected && { color: Colors.secondary }]}>
                    {method.name}
                  </Caption>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Input Form */}
        <View style={styles.formSection}>
          <Label style={styles.inputLabel}>Amount to Withdraw (ETB)</Label>
          <GlassCard style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </GlassCard>

          <Label style={styles.inputLabel}>Account / Phone Number</Label>
          <GlassCard style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0911234567"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />
          </GlassCard>
        </View>

        <GradientButton
          title={isLoading ? 'Processing...' : 'Request Withdrawal'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={{ marginTop: 10 }}
        />

        <Body style={styles.disclaimer}>
          Withdrawals usually take between 15 minutes to 2 hours to process.
        </Body>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  content: { paddingTop: 56, paddingHorizontal: 24 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  section: { marginBottom: 24 },
  inputLabel: { marginBottom: 12, marginLeft: 4, color: 'rgba(255,255,255,0.6)' },
  methodsGrid: { flexDirection: 'row', gap: 12 },
  methodCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.lg, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  methodCardActive: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(245,176,65,0.05)',
  },
  methodIcon: { fontSize: 28, marginBottom: 8 },
  methodName: { color: Colors.textMuted, fontWeight: 'bold' },
  checkBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  formSection: { marginBottom: 10 },
  inputContainer: { padding: 4, marginBottom: 20 },
  input: {
    color: '#fff', fontSize: 18, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: Typography.primary,
  },
  disclaimer: {
    textAlign: 'center', color: Colors.textMuted, marginTop: 24, fontSize: 13,
  },
});
