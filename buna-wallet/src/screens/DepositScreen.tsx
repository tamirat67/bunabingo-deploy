import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { H2, Body, Caption, Label } from '../components/Typography';
import { requestDeposit } from '../services/walletService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type DepositScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Deposit'>;

export const DepositScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<DepositScreenNavigationProp>();
  
  const [amount, setAmount] = useState('');
  const [txnId, setTxnId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }
    if (!txnId || txnId.trim().length < 5) {
      Alert.alert('Invalid TxnID', 'Please enter a valid Telebirr Transaction ID.');
      return;
    }
    if (!user?.phone) {
      Alert.alert('Authentication Error', 'Could not verify your user ID. Please log in again.');
      return;
    }

    setIsLoading(true);
    try {
      await requestDeposit({
        userId: user.phone, // We use the normalized phone number as their userId for the wallet
        amount: Number(amount),
        txnId: txnId.trim(),
      });
      
      Alert.alert(
        'Deposit Request Received! 🎉',
        'Your request is pending. Our system is waiting for the Telebirr SMS to verify your transaction automatically.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Deposit Failed', err.message || 'Something went wrong.');
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
          <H2>Telebirr Deposit</H2>
          <View style={{ width: 40 }} /> {/* Spacer */}
        </View>

        {/* Instructions Card */}
        <LinearGradient
          colors={['#2E1B0F', '#4B2E1F', '#3A2415']}
          style={styles.instructionCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardShine} />
          <View style={styles.instructionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="phone-portrait-outline" size={24} color="#F5B041" />
            </View>
            <H2 style={{ color: '#F5B041', marginLeft: 12 }}>How to deposit</H2>
          </View>
          
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}><Caption style={styles.stepBadgeText}>1</Caption></View>
            <Body style={styles.stepText}>Open your Telebirr App or dial *127#</Body>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}><Caption style={styles.stepBadgeText}>2</Caption></View>
            <Body style={styles.stepText}>Send money to <Body style={{color: '#F5B041', fontWeight: 'bold'}}>0969455111</Body></Body>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}><Caption style={styles.stepBadgeText}>3</Caption></View>
            <Body style={styles.stepText}>Copy the TxnID from the SMS and paste it below.</Body>
          </View>
        </LinearGradient>

        {/* Input Form */}
        <View style={styles.formSection}>
          <Label style={styles.inputLabel}>Deposit Amount (ETB)</Label>
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

          <Label style={styles.inputLabel}>Telebirr Transaction ID</Label>
          <GlassCard style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. DGL949EVLP"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              value={txnId}
              onChangeText={setTxnId}
            />
          </GlassCard>
        </View>

        <GradientButton
          title={isLoading ? 'Processing...' : 'Submit Deposit'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={{ marginTop: 20 }}
        />

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
  instructionCard: {
    borderRadius: BorderRadius['2xl'], padding: 24,
    marginBottom: 32, overflow: 'hidden', position: 'relative',
    ...Shadows.gold,
  },
  cardShine: {
    position: 'absolute', top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(245,176,65,0.1)',
  },
  instructionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,176,65,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stepBadgeText: {
    color: '#fff', fontWeight: 'bold',
  },
  stepText: {
    flex: 1, color: 'rgba(255,255,255,0.8)',
  },
  formSection: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8, marginLeft: 4, color: 'rgba(255,255,255,0.6)',
  },
  inputContainer: {
    padding: 4, marginBottom: 20,
  },
  input: {
    color: '#fff',
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Typography.primary,
  },
});
