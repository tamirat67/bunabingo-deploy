import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Image,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 32;

// ─── Service Definitions ──────────────────────────────────────────────────────
const SERVICES_ROW1 = [
  { key: 'transfer', icon: 'swap-horizontal-outline', label: 'Transfer', isNew: true, lib: 'ion' },
  { key: 'airtime', icon: 'phone-portrait-outline', label: 'Airtime', isNew: false, lib: 'ion' },
  { key: 'payment', icon: 'card-outline', label: 'Payment', isNew: false, lib: 'ion' },
  { key: 'withdrawal', icon: 'cash-outline', label: 'Withdrawal', isNew: false, lib: 'ion' },
];

const SERVICES_ROW2 = [
  { key: 'voucher', icon: 'ticket-outline', label: 'Voucher', isNew: false, lib: 'ion' },
  { key: 'insurance', icon: 'umbrella-outline', label: 'Insurance', isNew: false, lib: 'mci' },
  { key: 'fuel', icon: 'speedometer-outline', label: 'Fuel', isNew: false, lib: 'ion' },
  { key: 'all', icon: 'grid-outline', label: 'All Services', isNew: false, lib: 'ion' },
];

const SERVICES_ROW3 = [
  { key: 'saving', icon: 'save-outline', label: 'Saving', isNew: false, lib: 'ion' },
  { key: 'finance', icon: 'trending-up-outline', label: 'Financial Services', isNew: false, lib: 'ion' },
];

// ─── Promotional Banners ──────────────────────────────────────────────────────
const BANNERS = [
  {
    id: 'b1',
    image: require('../../assets/banners/banner1.png'),
  },
  {
    id: 'b2',
    image: require('../../assets/banners/banner2.png'),
  },
  {
    id: 'b3',
    image: require('../../assets/banners/banner3.png'),
  },
  {
    id: 'b4',
    image: require('../../assets/banners/banner4.png'),
  },
  {
    id: 'b5',
    image: require('../../assets/banners/banner5.png'),
  },
];

// ─── Greeting Helper ──────────────────────────────────────────────────────────
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ─── Service Icon Component ───────────────────────────────────────────────────
const ServiceIcon = ({ icon, lib }: { icon: string; lib: string }) => {
  if (lib === 'mci') {
    return <MaterialCommunityIcons name={icon as any} size={26} color={Colors.secondary} />;
  }
  return <Ionicons name={icon as any} size={26} color={Colors.secondary} />;
};

// ─── Service Card Component ───────────────────────────────────────────────────
const ServiceCard = ({
  svc,
  wide = false,
  onPress,
}: {
  svc: { key: string; icon: string; label: string; isNew: boolean; lib: string };
  wide?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.serviceCard, wide && styles.serviceCardWide]}
    activeOpacity={0.75}
    onPress={onPress}
  >
    {svc.isNew && (
      <View style={styles.newBadge}>
        <Text style={styles.newBadgeText}>NEW</Text>
      </View>
    )}
    <View style={styles.serviceIconBox}>
      <ServiceIcon icon={svc.icon} lib={svc.lib} />
    </View>
    <Text style={styles.serviceLabel} numberOfLines={1}>
      {svc.label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const HomeScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const nav = navigation || useNavigation<any>();

  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const userName = user?.name ? user.name.split(' ')[0] : 'User';
  const balance = user?.balance ?? 0;

  useEffect(() => {
    refreshProfile();
  }, []);

  // Auto-scroll banners
  useEffect(() => {
    autoScrollTimer.current = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, []);

  const handleBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    if (index !== activeBanner) setActiveBanner(index);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const handleServicePress = (key: string) => {
    if (key === 'transfer') nav.navigate('Transfer');
    else if (key === 'all') nav.navigate('Wallet');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.bunaLogoImg}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.greetingSmall}>{getGreeting()},</Text>
              <Text style={styles.greetingName}>{userName} 👋</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            activeOpacity={0.7}
            onPress={() => nav.navigate('Profile')}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* ── BALANCE CARD ── */}
        <LinearGradient
          colors={Colors.espressoGradient as any}
          style={[styles.balanceCard, Shadows.espresso as any]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative Circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <View style={styles.balanceCardTop}>
            <View style={styles.balanceCardTopLeft}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.cardLogoImg}
                resizeMode="contain"
              />
              <Text style={styles.balanceLabel}>Wallet Balance</Text>
            </View>
            <TouchableOpacity onPress={() => setBalanceHidden(!balanceHidden)}>
              <Ionicons
                name={balanceHidden ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={Colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceAmountRow}>
            {balanceHidden ? (
              <Text style={styles.balanceMasked}>••••••</Text>
            ) : (
              <Text style={styles.balanceAmount}>
                {balance.toLocaleString('en-ET', { minimumFractionDigits: 2 })}
              </Text>
            )}
            <Text style={styles.balanceCurrency}> ETB</Text>
          </View>

          <View style={styles.balanceCardBottom}>
            <TouchableOpacity style={styles.balanceActionBtn} activeOpacity={0.8}
              onPress={() => nav.navigate('Transfer')}>
              <Ionicons name="arrow-up-outline" size={16} color={Colors.secondary} />
              <Text style={styles.balanceActionText}>Send</Text>
            </TouchableOpacity>
            <View style={styles.balanceSeparator} />
            <TouchableOpacity style={styles.balanceActionBtn} activeOpacity={0.8}>
              <Ionicons name="arrow-down-outline" size={16} color={Colors.secondary} />
              <Text style={styles.balanceActionText}>Receive</Text>
            </TouchableOpacity>
            <View style={styles.balanceSeparator} />
            <TouchableOpacity style={styles.balanceActionBtn} activeOpacity={0.8} onPress={handleRefresh}>
              <Ionicons name="refresh-outline" size={16} color={Colors.secondary} />
              <Text style={styles.balanceActionText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── SERVICES SECTION ── */}
        <View style={styles.servicesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* Row 1: Transfer · Airtime · Payment · Withdrawal */}
          <View style={styles.serviceRow}>
            {SERVICES_ROW1.map((svc) => (
              <ServiceCard key={svc.key} svc={svc} onPress={() => handleServicePress(svc.key)} />
            ))}
          </View>

          {/* Row 2: Voucher · Insurance · Fuel · All Services */}
          <View style={styles.serviceRow}>
            {SERVICES_ROW2.map((svc) => (
              <ServiceCard key={svc.key} svc={svc} onPress={() => handleServicePress(svc.key)} />
            ))}
          </View>

          {/* Row 3: Saving · Financial Services (2-col wide) */}
          <View style={styles.serviceRowWide}>
            {SERVICES_ROW3.map((svc) => (
              <ServiceCard key={svc.key} svc={svc} wide onPress={() => handleServicePress(svc.key)} />
            ))}
          </View>

          {/* Expand chevron */}
          <TouchableOpacity style={styles.chevronBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── PROMOTIONAL BANNERS ── */}
        <View style={styles.bannersSection}>
          <Text style={styles.sectionTitle}>Promotions</Text>
          <FlatList
            ref={bannerRef}
            data={BANNERS}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={BANNER_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.bannerList}
            onScroll={handleBannerScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.9} style={styles.bannerCard}>
                <Image
                  source={item.image}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />

          {/* Dot Indicators */}
          <View style={styles.dotsRow}>
            {BANNERS.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  bannerRef.current?.scrollToIndex({ index: i, animated: true });
                  setActiveBanner(i);
                }}
              >
                <View
                  style={[
                    styles.dot,
                    i === activeBanner ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── QUICK TRANSACTIONS ── */}
        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={[styles.emptyCard, Shadows.card as any]}>
            <Ionicons name="receipt-outline" size={32} color={Colors.border} />
            <Text style={styles.emptyText}>No recent transactions</Text>
            <Text style={styles.emptySubText}>Your recent activity will appear here</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_SIZE = (width - 40 - 36) / 4; // 4 cols with padding & gaps

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bunaLogoImg: {
    width: 46,
    height: 46,
    borderRadius: 10,
  },
  greetingSmall: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Shadows.sm as any),
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: Colors.backgroundAlt,
  },

  // ── Balance Card ──
  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(212,175,55,0.07)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.05)',
    bottom: -40,
    left: 20,
  },
  balanceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLogoImg: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: Colors.secondaryLight,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  balanceMasked: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 6,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: -0.5,
  },
  balanceCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondaryLight,
    marginBottom: 6,
    marginLeft: 4,
  },
  balanceCardBottom: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  balanceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  balanceActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  balanceSeparator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },

  // ── Services ──
  servicesSection: {
    backgroundColor: Colors.backgroundAlt,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...(Shadows.card as any),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },

  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceRowWide: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },

  serviceCard: {
    width: CARD_SIZE,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  serviceCardWide: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  serviceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  chevronBtn: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 2,
  },

  // ── Promo Banners ──
  bannersSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  bannerList: {
    paddingRight: 16,
    gap: 12,
    marginTop: 12,
    paddingBottom: 4,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    ...(Shadows.card as any),
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: Colors.border,
  },

  // ── Recent Activity ──
  quickSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
