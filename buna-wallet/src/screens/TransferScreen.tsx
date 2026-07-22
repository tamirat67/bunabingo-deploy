import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, TextInput, Alert, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { H2, Body, Caption, Label } from '../components/Typography';
import { requestTransfer } from '../services/walletService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type TransferScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Transfer'>;

export const TransferScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<TransferScreenNavigationProp>();
  
  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // User Search Suggestion State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`https://api.bunatechhub.net/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.users);
        setShowSuggestions(data.users.length > 0);
      }
    } catch (e) {
      console.warn('Search error:', e);
    }
  };

  const handlePhoneChange = (text: string) => {
    setRecipientPhone(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);
  };

  const handleSelectSuggestion = (u: any) => {
    setRecipientPhone(u.phone);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      return;
    }
    if (!recipientPhone || recipientPhone.trim().length < 9) {
      Alert.alert('Invalid Recipient', 'Please enter a valid recipient phone number.');
      return;
    }
    if (!user?.phone) {
      Alert.alert('Authentication Error', 'Could not verify your user ID. Please log in again.');
      return;
    }

    setIsLoading(true);
    try {
      await requestTransfer({
        senderId: user.phone,
        amount: Number(amount),
        recipientPhone: recipientPhone.trim(),
      });
      
      Alert.alert(
        'Transfer Successful! 🎉',
        `You have sent ${amount} ETB to ${recipientPhone}. It has been deposited into their Buna Wallet instantly.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Transfer Failed', err.message || 'Something went wrong. Do you have enough balance?');
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
          <H2>Send Money</H2>
          <View style={{ width: 40 }} />
        </View>

        {/* Feature Highlight */}
        <LinearGradient
          colors={['rgba(245,176,65,0.1)', 'rgba(245,176,65,0.02)']}
          style={styles.banner}
        >
          <View style={styles.bannerIconBox}>
            <Ionicons name="flash" size={24} color={Colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={styles.bannerTitle}>Instant & 100% Free</Body>
            <Caption style={{ color: Colors.textMuted }}>
              Send money directly to any Buna Wallet user instantly. No fees, no delays!
            </Caption>
          </View>
        </LinearGradient>

        {/* Input Form */}
        <View style={styles.formSection}>
          <Label style={styles.inputLabel}>Recipient Phone Number</Label>
          <GlassCard style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 0911234567"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="default" // allow text for username search
                value={recipientPhone}
                onChangeText={handlePhoneChange}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
            </View>
          </GlassCard>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(u)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>{u.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.suggestionName}>{u.name}</Text>
                    <Text style={styles.suggestionPhone}>{u.phone}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Label style={styles.inputLabel}>Amount to Send (ETB)</Label>
          <GlassCard style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <Text style={styles.currencySymbol}>ETB</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </GlassCard>
        </View>

        <GradientButton
          title={isLoading ? 'Sending...' : 'Send Now'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={{ marginTop: 10 }}
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
  banner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: 'rgba(245,176,65,0.2)',
    marginBottom: 28,
  },
  bannerIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(245,176,65,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  bannerTitle: { color: Colors.secondary, fontWeight: 'bold', marginBottom: 2 },
  formSection: { marginBottom: 10 },
  inputLabel: { marginBottom: 12, marginLeft: 4, color: 'rgba(255,255,255,0.6)' },
  inputContainer: { padding: 4, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  currencySymbol: {
    color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginRight: 8, fontSize: 16,
  },
  input: {
    flex: 1, color: '#fff', fontSize: 18, paddingVertical: 14,
    fontFamily: Typography.primary,
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: -12,
    marginBottom: 20,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionAvatarText: {
    color: '#1A1225',
    fontWeight: 'bold',
    fontSize: 16,
  },
  suggestionName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionPhone: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
});
