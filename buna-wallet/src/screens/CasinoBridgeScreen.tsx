import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, TextInput, Alert, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { H2, Body, Caption, Label, H3 } from '../components/Typography';
import { transferToCasino, transferToWallet } from '../services/walletService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { MOCK_USER } from '../data/mockData';

type CasinoBridgeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CasinoBridge'>;

export const CasinoBridgeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<CasinoBridgeNavigationProp>();
  
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [direction, setDirection] = useState<'to_casino' | 'to_wallet'>('to_casino');

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      return;
    }
    if (!user?.phone) {
      Alert.alert('Authentication Error', 'Could not verify your user ID. Please log in again.');
      return;
    }

    setIsLoading(true);
    try {
      if (direction === 'to_casino') {
        await transferToCasino({ userId: user.phone, amount: Number(amount) });
        Alert.alert('Success! 🎉', `Transferred ${amount} ETB to your Casino balance to play games!`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await transferToWallet({ userId: user.phone, amount: Number(amount) });
        Alert.alert('Success! 💸', `Withdrew ${amount} ETB to your App Wallet for payout!`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (err: any) {
      Alert.alert('Transfer Failed', err.message || 'Something went wrong. Please check your balance.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#3A1225', '#0F1115']} style={styles.bgGrad} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <H2>Casino Bridge</H2>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.balancesBox}>
           <View style={styles.balanceCol}>
              <Label>App Wallet</Label>
              <H3 style={{ color: Colors.success }}>{MOCK_USER.balance} ETB</H3>
           </View>
           <Ionicons name="swap-horizontal" size={28} color="rgba(255,255,255,0.4)" />
           <View style={styles.balanceCol}>
              <Label>Casino Wallet</Label>
              <H3 style={{ color: Colors.accent }}>0.00 ETB</H3>
           </View>
        </View>

        <View style={styles.directionToggle}>
           <TouchableOpacity 
             style={[styles.toggleBtn, direction === 'to_casino' && styles.toggleBtnActive]}
             onPress={() => setDirection('to_casino')}
           >
              <Ionicons name="game-controller" size={20} color={direction === 'to_casino' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <Body style={[styles.toggleText, direction === 'to_casino' && styles.toggleTextActive]}>Deposit to Game</Body>
           </TouchableOpacity>
           
           <TouchableOpacity 
             style={[styles.toggleBtn, direction === 'to_wallet' && styles.toggleBtnActive]}
             onPress={() => setDirection('to_wallet')}
           >
              <Ionicons name="wallet" size={20} color={direction === 'to_wallet' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <Body style={[styles.toggleText, direction === 'to_wallet' && styles.toggleTextActive]}>Withdraw from Game</Body>
           </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <Label style={styles.inputLabel}>Amount (ETB)</Label>
          <GlassCard style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </GlassCard>
        </View>

        <GradientButton
          title={isLoading ? 'Processing...' : 'Transfer Instantly'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={{ marginTop: 10 }}
        />

        <Caption style={styles.disclaimer}>Transfers between your App Wallet and Casino Wallet are instant and 100% free.</Caption>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  content: { paddingTop: 56, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balancesBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: BorderRadius.xl, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balanceCol: { alignItems: 'center' },
  directionToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: BorderRadius.lg, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md },
  toggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  toggleText: { color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' },
  toggleTextActive: { color: '#fff' },
  formSection: { marginBottom: 10 },
  inputLabel: { marginBottom: 12, marginLeft: 4, color: 'rgba(255,255,255,0.6)' },
  inputContainer: { padding: 4, marginBottom: 20 },
  input: { color: '#fff', fontSize: 18, paddingHorizontal: 16, paddingVertical: 14, fontFamily: Typography.fontFamily.regular },
  disclaimer: { textAlign: 'center', color: Colors.textMuted, marginTop: 24, fontSize: 13 },
});
