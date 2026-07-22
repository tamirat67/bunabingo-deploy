import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const GOLD = '#D4AF37';
const TEXT_DARK = '#1C1C1E';
const TEXT_MUTED = '#6E6E73';
const BG = '#F8F8F8';
const WHITE = '#FFFFFF';

const SettingRow = ({
  icon,
  title,
  subtitle,
  onPress,
  showDots,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showDots?: boolean;
}) => (
  <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={onPress}>
    <View style={styles.settingLeft}>
      <View style={styles.settingIconBox}>
        <Ionicons name={icon as any} size={20} color={TEXT_DARK} />
      </View>
      <View>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {showDots ? (
      <Ionicons name="ellipsis-vertical" size={18} color={TEXT_MUTED} />
    ) : (
      <View />
    )}
  </TouchableOpacity>
);

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const userName = user?.name || 'Buna User';
  const userPhone = user?.phone || '';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* ── AVATAR + NAME ── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-circle-outline" size={80} color={TEXT_DARK} />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userPhone}>{userPhone}</Text>
        </View>

        {/* ── DIVIDER ── */}
        <View style={styles.divider} />

        {/* ── SETTINGS LIST ── */}
        <View style={styles.settingsList}>
          <SettingRow
            icon="language-outline"
            title="Language"
            subtitle="en"
          />
          <View style={styles.listDivider} />
          <SettingRow
            icon="shield-outline"
            title="Security"
            subtitle="pin code, fingerprint"
          />
          <View style={styles.listDivider} />
          <SettingRow
            icon="help-circle-outline"
            title="Customer Support"
            subtitle="Contact Us"
            showDots
          />
        </View>

        {/* ── VERSION ── */}
        <Text style={styles.version}>Version 2.1.4</Text>

        {/* ── LOGOUT ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={TEXT_MUTED} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 0,
    marginBottom: 8,
  },
  settingsList: {
    backgroundColor: WHITE,
    marginHorizontal: 0,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  listDivider: {
    height: 1,
    backgroundColor: '#F0F0F2',
    marginLeft: 70,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#C0C0C5',
    marginBottom: 32,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 15,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
});
