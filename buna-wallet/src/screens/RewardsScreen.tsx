import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { H2, H3, Body, Caption, Label, Amount } from '../components/Typography';
import { MOCK_USER } from '../data/mockData';

const { width } = Dimensions.get('window');

const REWARDS_DATA = [
  { icon: 'star', label: 'Reward Points', value: '2,340 pts', color: Colors.secondary, bg: 'rgba(245,176,65,0.12)' },
  { icon: 'cash', label: 'Cashback', value: 'ETB 125.50', color: Colors.success, bg: 'rgba(52,199,89,0.12)' },
  { icon: 'people', label: 'Referral Earnings', value: 'ETB 300', color: Colors.info, bg: 'rgba(10,132,255,0.12)' },
  { icon: 'trophy', label: 'Bingo Winnings', value: 'ETB 1,500', color: Colors.accent, bg: 'rgba(91,44,131,0.12)' },
];

const ACHIEVEMENTS = [
  { icon: '🎯', title: 'First Deposit', desc: 'Made your first deposit', earned: true },
  { icon: '🚀', title: 'Early Adopter', desc: 'Joined in the first 1000 users', earned: true },
  { icon: '💸', title: 'Big Spender', desc: 'Spent over ETB 10,000', earned: false },
  { icon: '👑', title: 'VIP Gold', desc: 'Reached Gold status', earned: true },
  { icon: '🤝', title: 'Social', desc: 'Referred 5+ friends', earned: false },
  { icon: '🎰', title: 'Bingo King', desc: 'Won 10 Bingo games', earned: false },
];

export const RewardsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#1A0E2E', '#0F1115']} style={styles.bgGrad} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <H2>Rewards</H2>
          <View style={styles.vipBadge}>
            <Ionicons name="star" size={12} color="#4B2E1F" />
            <Caption style={styles.vipText}>{MOCK_USER.vipLevel} Member</Caption>
          </View>
        </View>

        {/* Points Banner */}
        <LinearGradient
          colors={['#5B2C83', '#7B3CB3', '#5B2C83']}
          style={styles.pointsBanner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.pointsGlow} />
          <Label style={styles.pointsLabel}>Total Reward Points</Label>
          <Amount size="xl" style={styles.pointsAmount}>{MOCK_USER.rewardPoints.toLocaleString()}</Amount>
          <Caption style={styles.pointsSub} color="rgba(255,255,255,0.65)">
            = ETB {(MOCK_USER.rewardPoints * 0.1).toFixed(2)} equivalent
          </Caption>
          <TouchableOpacity style={styles.redeemBtn} activeOpacity={0.8}>
            <Caption style={styles.redeemText}>Redeem Points →</Caption>
          </TouchableOpacity>
        </LinearGradient>

        {/* Reward Cards Grid */}
        <View style={styles.grid}>
          {REWARDS_DATA.map((item, i) => (
            <GlassCard key={i} variant="elevated" padding={16} style={styles.gridCard}>
              <View style={[styles.gridIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Label style={styles.gridLabel}>{item.label}</Label>
              <Body style={[styles.gridValue, { color: item.color }]} color={item.color}>
                {item.value}
              </Body>
            </GlassCard>
          ))}
        </View>

        {/* Weekly Bonus */}
        <LinearGradient
          colors={['#F5B041', '#E67E22']}
          style={styles.weeklyBanner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <View>
            <Body style={styles.weeklyTitle}>Weekly Bonus Active 🎉</Body>
            <Caption style={styles.weeklySub}>Earn 2x points on all transactions until Sunday</Caption>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
        </LinearGradient>

        {/* Achievements */}
        <View style={styles.section}>
          <H3 style={styles.sectionTitle}>Achievements</H3>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENTS.map((a, i) => (
              <View key={i} style={[styles.achievement, !a.earned && styles.achievementLocked]}>
                <Body style={styles.achievementIcon}>{a.icon}</Body>
                <Caption style={styles.achievementTitle} color={a.earned ? Colors.textPrimary : Colors.textMuted}>
                  {a.title}
                </Caption>
                {a.earned && <View style={styles.earnedDot} />}
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 250 },
  content: { paddingTop: 56, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  vipBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, gap: 4 },
  vipText: { color: '#4B2E1F', fontWeight: Typography.weight.bold, fontSize: Typography.size.xs },
  pointsBanner: { borderRadius: BorderRadius['2xl'], padding: 24, marginBottom: 24, overflow: 'hidden', position: 'relative', ...Shadows.purple },
  pointsGlow: { position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)' },
  pointsLabel: { color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  pointsAmount: { color: '#fff', marginBottom: 6 },
  pointsSub: { marginBottom: 16 },
  redeemBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 8 },
  redeemText: { color: '#fff', fontWeight: Typography.weight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  gridCard: { width: (width - 60) / 2, minWidth: 0 },
  gridIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridLabel: { marginBottom: 4, color: Colors.textMuted },
  gridValue: { fontWeight: Typography.weight.bold, fontSize: Typography.size.base },
  weeklyBanner: { borderRadius: BorderRadius.xl, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  weeklyTitle: { color: '#fff', fontWeight: Typography.weight.bold, marginBottom: 4 },
  weeklySub: { color: 'rgba(255,255,255,0.8)' },
  section: { marginBottom: 28 },
  sectionTitle: { marginBottom: 16 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  achievement: { width: (width - 72) / 3, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, alignItems: 'center', paddingVertical: 16, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  achievementLocked: { opacity: 0.45 },
  achievementIcon: { fontSize: 28, marginBottom: 8 },
  achievementTitle: { fontSize: Typography.size.xs, textAlign: 'center', fontWeight: Typography.weight.medium },
  earnedDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
});
