import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../theme';
import { H2, Body, Caption, Label } from '../components/Typography';
import { MOCK_USER } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export const ProfileScreen: React.FC = () => {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#1A1225', '#0F1115']} style={styles.bgGrad} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <H2>Profile</H2>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={['#F5B041', '#E67E22']} style={styles.avatar}>
              <H2 style={styles.avatarText}>{MOCK_USER.name.charAt(0)}</H2>
            </LinearGradient>
            <TouchableOpacity style={styles.editAvatarBtn} activeOpacity={0.8}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <H3 style={styles.name}>{MOCK_USER.name}</H3>
          <Body style={styles.phone} color={Colors.textSecondary}>{MOCK_USER.phone}</Body>
          <View style={styles.kycBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
            <Caption style={styles.kycText}>Verified Account</Caption>
          </View>
        </View>

        <View style={styles.section}>
          <Label style={styles.sectionTitle}>Account Settings</Label>
          <View style={styles.card}>
            <SettingRow icon="person-outline" title="Personal Information" />
            <SettingRow icon="wallet-outline" title="Linked Banks & Cards" />
            <SettingRow icon="shield-checkmark-outline" title="Security & PIN" />
            <SettingRow icon="notifications-outline" title="Notifications" />
          </View>
        </View>

        <View style={styles.section}>
          <Label style={styles.sectionTitle}>Support & About</Label>
          <View style={styles.card}>
            <SettingRow icon="help-buoy-outline" title="Help Center" />
            <SettingRow icon="document-text-outline" title="Terms & Privacy" />
            <SettingRow icon="information-circle-outline" title="About Buna Wallet" />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Body style={styles.logoutText} color={Colors.danger}>Log Out</Body>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const SettingRow = ({ icon, title }: { icon: string; title: string }) => (
  <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
    <View style={styles.settingLeft}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
      </View>
      <Body style={styles.settingTitle}>{title}</Body>
    </View>
    <Ionicons name="chevron-forward" size={20} color={Colors.border} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  content: { paddingTop: 56, paddingHorizontal: 24 },
  header: { marginBottom: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 32 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.cardAlt, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  name: { marginBottom: 4, fontWeight: Typography.weight.bold, fontSize: Typography.size.xl, color: Colors.textPrimary },
  phone: { marginBottom: 12 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52,199,89,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, gap: 6 },
  kycText: { color: Colors.success, fontWeight: Typography.weight.semiBold },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12, marginLeft: 12 },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontWeight: Typography.weight.medium, color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', marginTop: 8 },
  logoutText: { fontWeight: Typography.weight.bold },
});

// Create H3 to fix undefined H3
const H3 = ({children, style}: any) => <Body style={[{fontSize: Typography.size.xl, fontWeight: 'bold'}, style]}>{children}</Body>;
