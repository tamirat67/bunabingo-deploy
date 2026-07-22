import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const GOLD = '#D4AF37';
const GOLD_LIGHT = '#F0D060';
const GOLD_DARK = '#B8860B';
const TEXT_DARK = '#1C1C1E';
const TEXT_MUTED = '#6E6E73';
const BG = '#F8F8F8';
const WHITE = '#FFFFFF';

const SERVICES = [
  { icon: 'school-outline', label: 'School Pay', color: '#4A90D9' },
  { icon: 'phone-portrait-outline', label: 'Airtime', color: '#E74C3C' },
  { icon: 'receipt-outline', label: 'Pay Bills', color: '#27AE60' },
  { icon: 'heart-outline', label: 'Donation', color: '#D4AF37' },
];

export const HomeScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user, refreshProfile, logout } = useAuth();
  const nav = navigation || useNavigation<any>();

  const [balanceHidden, setBalanceHidden] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, []);

  const userName = user?.name ? user.name.split(' ')[0] : 'User';
  const balance = user?.balance ?? 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.7}>
            <Ionicons name="person-circle-outline" size={42} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={styles.greetingText}>
            Hello <Text style={styles.greetingName}>{userName}</Text>
          </Text>
        </View>

        {/* ── BALANCE CARD ── */}
        <LinearGradient
          colors={['#D4AF37', '#C59B27', '#A8841A']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.balanceCardTop}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <TouchableOpacity onPress={() => setBalanceHidden(!balanceHidden)}>
              <Ionicons
                name={balanceHidden ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="rgba(255,255,255,0.85)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceAmountRow}>
            {balanceHidden ? (
              <Text style={styles.balanceMasked}>- - -</Text>
            ) : (
              <Text style={styles.balanceAmount}>
                {balance.toLocaleString('en-ET', { minimumFractionDigits: 2 })}
              </Text>
            )}
            <Text style={styles.balanceCurrency}> Birr</Text>

            <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
              <Ionicons
                name="refresh-outline"
                size={18}
                color="rgba(255,255,255,0.85)"
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── LINKED ACCOUNTS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked accounts</Text>
          <View style={styles.linkedRow}>
            <Text style={styles.noLinked}>No linked accounts. Link here</Text>
            <TouchableOpacity style={styles.addAccountBtn} activeOpacity={0.8}>
              <Ionicons name="add" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SERVICES ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((svc, i) => (
              <TouchableOpacity key={i} style={styles.serviceCard} activeOpacity={0.8}>
                <Ionicons name={svc.icon as any} size={28} color={svc.color} />
                <Text style={styles.serviceLabel}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  avatarBtn: {
    marginRight: 12,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  greetingName: {
    fontWeight: '700',
    color: TEXT_DARK,
  },
  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 22,
    marginBottom: 28,
    minHeight: 140,
  },
  balanceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  balanceMasked: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 4,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
  },
  balanceCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
    marginLeft: 4,
    flex: 1,
  },
  refreshBtn: {
    marginBottom: 4,
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 16,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noLinked: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  addAccountBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D0D0D5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  serviceCard: {
    width: (width - 52) / 2,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
});
