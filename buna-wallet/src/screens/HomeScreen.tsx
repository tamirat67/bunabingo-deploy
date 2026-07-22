import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { QuickActionsRow } from '../components/QuickActions';
import { TransactionItem } from '../components/TransactionItem';
import { H1, H2, H3, Body, Caption, Label, Amount } from '../components/Typography';
import { MOCK_USER, MOCK_TRANSACTIONS, MOCK_PROMOS } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const QUICK_ACTIONS = [
  { icon: 'send', label: 'Send', color: Colors.secondary, bg: 'rgba(245,176,65,0.12)' },
  { icon: 'download', label: 'Deposit', color: Colors.success, bg: 'rgba(52,199,89,0.12)' },
  { icon: 'cash', label: 'Withdraw', color: Colors.info, bg: 'rgba(10,132,255,0.12)' },
  { icon: 'qr-code', label: 'Scan QR', color: Colors.accent, bg: 'rgba(91,44,131,0.12)' },
  { icon: 'receipt', label: 'Pay Bill', color: Colors.warning, bg: 'rgba(255,149,0,0.12)' },
];

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [activePromo, setActivePromo] = useState(0);

  const promoRef = useRef<FlatList>(null);

  useEffect(() => {
    refreshProfile();
  }, []);

  const userName = user?.name || MOCK_USER.name;
  const userBalance = user?.balance ?? 0;
  const walletId = user?.walletId || MOCK_USER.walletId;

  const displayBalance = balanceHidden
    ? '••••••'
    : `ETB ${userBalance.toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Decorative background gradient */}
      <LinearGradient
        colors={['#1A1225', '#0F1115', '#0F1115']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glowAccent} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <View>
            <Caption color={Colors.textMuted}>Good morning 👋</Caption>
            <H3 style={styles.userName}>{userName.split(' ')[0]}</H3>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
              <LinearGradient colors={['#F5B041', '#E67E22']} style={styles.avatar}>
                <Body style={styles.avatarLetter}>{userName.charAt(0).toUpperCase()}</Body>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BALANCE CARD ── */}
        <LinearGradient
          colors={['#2E1B0F', '#4B2E1F', '#3A2415']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Gold shimmer overlay */}
          <View style={styles.cardGlow} />

          <View style={styles.balanceTop}>
            <View>
              <Label style={styles.balanceLabel}>Available Balance</Label>
              <View style={styles.balanceRow}>
                <Amount size="xl" style={styles.balanceAmount}>{displayBalance}</Amount>
                <TouchableOpacity
                  onPress={() => setBalanceHidden(!balanceHidden)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={balanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* VIP Badge */}
            <View style={styles.vipBadge}>
              <Ionicons name="star" size={12} color="#4B2E1F" />
              <Caption style={styles.vipText}>{MOCK_USER.vipLevel}</Caption>
            </View>
          </View>

          {/* Card Details */}
          <View style={styles.cardDetails}>
            <View>
              <Caption color="rgba(255,255,255,0.5)">Wallet ID</Caption>
              <Body style={styles.walletId}>{walletId}</Body>
            </View>
            <View style={styles.pointsPill}>
              <Ionicons name="star-outline" size={14} color={Colors.secondary} />
              <Caption style={styles.pointsText}>
                {MOCK_USER.rewardPoints.toLocaleString()} pts
              </Caption>
            </View>
          </View>
        </LinearGradient>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.section}>
          <QuickActionsRow actions={QUICK_ACTIONS.map(a => ({ ...a, onPress: () => {} }))} />
        </View>

        {/* ── PROMO BANNER CAROUSEL ── */}
        <View style={styles.promoSection}>
          <FlatList
            ref={promoRef}
            data={MOCK_PROMOS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={width - 48}
            decelerationRate="fast"
            contentContainerStyle={styles.promoList}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (width - 48));
              setActivePromo(index);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LinearGradient
                colors={item.gradient}
                style={styles.promoBanner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.promoBannerInner}>
                  <Ionicons name={item.icon as any} size={32} color="rgba(255,255,255,0.9)" />
                  <View style={styles.promoText}>
                    <Body style={styles.promoTitle}>{item.title}</Body>
                    <Caption style={styles.promoSubtitle}>{item.subtitle}</Caption>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
              </LinearGradient>
            )}
          />
          {/* Dots */}
          <View style={styles.dotRow}>
            {MOCK_PROMOS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activePromo && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* ── RECENT TRANSACTIONS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <H3>Recent Activity</H3>
            <TouchableOpacity activeOpacity={0.7}>
              <Caption style={styles.seeAll}>See All</Caption>
            </TouchableOpacity>
          </View>

          <GlassCard variant="elevated" padding={16}>
            {MOCK_TRANSACTIONS.slice(0, 5).map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                onPress={() => {}}
              />
            ))}
          </GlassCard>
        </View>

        {/* ── FEATURED SERVICES ── */}
        <View style={styles.section}>
          <H3 style={styles.sectionTitle}>Featured Services</H3>
          <View style={styles.servicesGrid}>
            {SERVICES.map((svc, i) => (
              <TouchableOpacity key={i} style={styles.serviceCard} activeOpacity={0.75}>
                <LinearGradient colors={svc.gradient as any} style={styles.serviceIcon}>
                  <Ionicons name={svc.icon as any} size={22} color="#fff" />
                </LinearGradient>
                <Caption style={styles.serviceLabel}>{svc.label}</Caption>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const SERVICES = [
  { icon: 'flash', label: 'Electricity', gradient: ['#F5B041', '#E67E22'] },
  { icon: 'water', label: 'Water', gradient: ['#0A84FF', '#007AFF'] },
  { icon: 'phone-portrait', label: 'Airtime', gradient: ['#34C759', '#28A745'] },
  { icon: 'school', label: 'Schools', gradient: ['#7B3CB3', '#5B2C83'] },
  { icon: 'bus', label: 'Transport', gradient: ['#FF9500', '#FF6B00'] },
  { icon: 'game-controller', label: 'Bingo', gradient: ['#FF3B30', '#C0392B'] },
  { icon: 'shield-checkmark', label: 'Insurance', gradient: ['#26A5E4', '#1D8CB8'] },
  { icon: 'trending-up', label: 'Savings', gradient: ['#2ECC71', '#27AE60'] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  glowAccent: {
    position: 'absolute',
    top: 60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(91, 44, 131, 0.06)',
  },
  scrollContent: {
    paddingTop: 56,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  userName: {
    marginTop: 2,
    fontSize: Typography.size.xl,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
  avatarBtn: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: '#fff',
  },
  // Balance Card
  balanceCard: {
    marginHorizontal: 24,
    borderRadius: BorderRadius['2xl'],
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.gold,
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245, 176, 65, 0.12)',
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceAmount: {
    color: '#FFFFFF',
  },
  eyeBtn: {
    padding: 4,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  vipText: {
    color: '#4B2E1F',
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.xs,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletId: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: Typography.weight.medium,
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,176,65,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(245,176,65,0.25)',
    gap: 5,
  },
  pointsText: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
  },
  // Sections
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  seeAll: {
    color: Colors.secondary,
    fontWeight: Typography.weight.semiBold,
  },
  // Promo
  promoSection: {
    marginBottom: 28,
  },
  promoList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  promoBanner: {
    width: width - 48,
    padding: 20,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  promoBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  promoText: {
    flex: 1,
  },
  promoTitle: {
    color: '#fff',
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.md,
    marginBottom: 4,
  },
  promoSubtitle: {
    color: 'rgba(255,255,255,0.8)',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.secondary,
  },
  // Services Grid
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: (width - 48 - 36) / 4,
    alignItems: 'center',
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
