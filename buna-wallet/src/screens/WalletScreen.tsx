import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';

export const WalletScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    refreshProfile();
  }, []);

  const balance = user?.balance ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.topBar}>
          <View style={styles.titleRow}>
            <Text style={styles.titleBlack}>Buna </Text>
            <Text style={styles.titleGold}>Wallet</Text>
          </View>
          <TouchableOpacity onPress={refreshProfile}>
            <Ionicons name="notifications-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── BALANCE CARD ── */}
        <LinearGradient
          colors={Colors.espressoGradient as any}
          style={[styles.balanceCard, Shadows.espresso as any]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.cardSubtitle}>Your stored value</Text>
          <View style={styles.amountRow}>
            <Text style={styles.balanceAmount}>
              {balance.toLocaleString('en-ET', { minimumFractionDigits: 0 })}
            </Text>
            <Text style={styles.currency}> BIRR</Text>
          </View>
        </LinearGradient>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.actionsRow}>
          {[
            { icon: 'download-outline', label: 'Deposit', screen: 'Deposit' },
            { icon: 'arrow-up-outline', label: 'Withdraw', screen: 'Withdraw' },
            { icon: 'send-outline', label: 'Send', screen: 'Transfer' },
            { icon: 'qr-code-outline', label: 'Pay', screen: 'MainTabs' },
          ].map((a, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionBtn}
              activeOpacity={0.75}
              onPress={() => navigation.navigate(a.screen as any)}
            >
              <View style={[styles.actionIconBox, Shadows.sm as any]}>
                <Ionicons name={a.icon as any} size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CASINO BRIDGE ── */}
        <TouchableOpacity
          style={styles.bridgeBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CasinoBridge')}
        >
          <LinearGradient
            colors={['#5B2C83', '#7B3CB3']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.bridgeIconBox}>
            <Ionicons name="game-controller" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bridgeTitle}>Play Games & Bingo</Text>
            <Text style={styles.bridgeSub}>Transfer to Casino Balance</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </TouchableOpacity>

        {/* ── TRANSFER HISTORY ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Transfer history</Text>
            <TouchableOpacity>
              <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Empty state */}
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  titleGold: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.secondary,
  },
  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 26,
    marginBottom: 24,
  },
  cardSubtitle: {
    fontSize: 16,
    color: Colors.secondaryLight,
    fontWeight: '500',
    marginBottom: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.secondary,
  },
  currency: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondaryLight,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  bridgeBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  bridgeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bridgeTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 2,
  },
  bridgeSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
