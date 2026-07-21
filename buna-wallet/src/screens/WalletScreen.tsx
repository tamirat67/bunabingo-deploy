import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { TransactionItem } from '../components/TransactionItem';
import { H2, H3, Body, Caption, Label, Amount } from '../components/Typography';
import { MOCK_USER, MOCK_TRANSACTIONS } from '../data/mockData';

export const WalletScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#1A1225', '#0F1115']} style={styles.bgGrad} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <H2>My Wallet</H2>
          <TouchableOpacity style={styles.historyBtn} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={['#2E1B0F', '#4B2E1F', '#3A2415']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardShine} />
          <Label style={styles.cardLabel}>Total Assets</Label>
          <Amount size="xl" style={styles.totalAssets}>
            ETB {MOCK_USER.totalAssets.toLocaleString('en-ET', { minimumFractionDigits: 2 })}
          </Amount>
          <View style={styles.cardRow}>
            <View>
              <Label style={styles.subLabel}>Available</Label>
              <Body style={styles.subAmount} color={Colors.success}>
                ETB {MOCK_USER.balance.toLocaleString('en-ET', { minimumFractionDigits: 2 })}
              </Body>
            </View>
            <View style={styles.cardDivider} />
            <View>
              <Label style={styles.subLabel}>In Transit</Label>
              <Body style={styles.subAmount} color={Colors.warning}>
                ETB {(MOCK_USER.totalAssets - MOCK_USER.balance).toLocaleString('en-ET', { minimumFractionDigits: 2 })}
              </Body>
            </View>
          </View>
        </LinearGradient>

        {/* Casino Bridge Banner */}
        <TouchableOpacity 
          style={styles.bridgeBanner} 
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CasinoBridge')}
        >
          <LinearGradient
            colors={['#5B2C83', '#7B3CB3']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          <View style={styles.bridgeIconBox}>
             <Ionicons name="game-controller" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
             <Body style={styles.bridgeTitle}>Play Games & Bingo</Body>
             <Caption style={{ color: 'rgba(255,255,255,0.8)' }}>Transfer to Casino Balance</Caption>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          {[
            { icon: 'download', label: 'Deposit', color: Colors.success, bg: 'rgba(52,199,89,0.12)' },
            { icon: 'cash-outline', label: 'Withdraw', color: Colors.info, bg: 'rgba(10,132,255,0.12)' },
            { icon: 'send', label: 'Send', color: Colors.secondary, bg: 'rgba(245,176,65,0.12)' },
            { icon: 'qr-code', label: 'Pay', color: Colors.accent, bg: 'rgba(91,44,131,0.12)' },
          ].map((a, i) => (
            <TouchableOpacity 
              key={i} 
              style={styles.actionBtn} 
              activeOpacity={0.75}
              onPress={() => {
                if (a.label === 'Deposit') navigation.navigate('Deposit');
                if (a.label === 'Withdraw') navigation.navigate('Withdraw');
                if (a.label === 'Send') navigation.navigate('Transfer');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Caption style={styles.actionLabel}>{a.label}</Caption>
            </TouchableOpacity>
          ))}
        </View>

        {/* Deposit Methods (Horizontal Scroll for many items) */}
        <View style={styles.section}>
          <H3 style={styles.sectionTitle}>Deposit Methods</H3>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodsGrid}>
            {DEPOSIT_METHODS.map((m, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.methodCard} 
                activeOpacity={0.75}
                onPress={() => {
                  if (m.name === 'Telebirr') navigation.navigate('Deposit');
                  // TODO: Handle future integrations
                }}
              >
                <Body style={styles.methodIcon}>{m.icon}</Body>
                <Caption style={styles.methodName}>{m.name}</Caption>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <H3 style={styles.sectionTitle}>Transaction History</H3>
          <GlassCard variant="elevated" padding={16}>
            {MOCK_TRANSACTIONS.slice(0, 6).map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} onPress={() => {}} />
            ))}
          </GlassCard>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const DEPOSIT_METHODS = [
  { icon: '📱', name: 'Telebirr' },
  { icon: '🟢', name: 'M-PESA' },
  { icon: '💳', name: 'SantimPay' },
  { icon: '💸', name: 'Kacha' },
  { icon: '💼', name: 'Amole' },
  { icon: '🇪🇹', name: 'E-birr' },
  { icon: '🏦', name: 'YaYa Wallet' },
  { icon: '🪙', name: 'HabeshaCoin' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  content: { paddingTop: 56, paddingHorizontal: 24 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  historyBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  balanceCard: {
    borderRadius: BorderRadius['2xl'], padding: 24,
    marginBottom: 24, overflow: 'hidden', position: 'relative',
    ...Shadows.gold,
  },
  cardShine: {
    position: 'absolute', top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(245,176,65,0.1)',
  },
  cardLabel: { color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  totalAssets: { color: '#fff', marginBottom: 20 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  subLabel: { color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  subAmount: { fontWeight: Typography.weight.bold, fontSize: Typography.size.base },
  cardDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 24 },
  bridgeBanner: { borderRadius: BorderRadius.xl, overflow: 'hidden', padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24, ...Shadows.purple },
  bridgeIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  bridgeTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 2 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionIcon: { width: 52, height: 52, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { color: Colors.textSecondary, fontWeight: Typography.weight.medium },
  section: { marginBottom: 28 },
  sectionTitle: { marginBottom: 16 },
  methodsGrid: { flexDirection: 'row', gap: 12, paddingRight: 24 },
  methodCard: {
    width: 90, backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    alignItems: 'center', paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  methodIcon: { fontSize: 28, marginBottom: 8 },
  methodName: { color: Colors.textSecondary, fontWeight: Typography.weight.medium },
});
