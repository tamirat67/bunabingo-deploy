import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const GOLD = '#D4AF37';
const GOLD_DARK = '#B8860B';
const TEXT_DARK = '#1C1C1E';
const TEXT_MUTED = '#6E6E73';
const BG = '#F8F8F8';
const WHITE = '#FFFFFF';

// ─── Setting Row ──────────────────────────────────────────────────────────────
const SettingRow = ({
  icon,
  title,
  subtitle,
  onPress,
  showChevron,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
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
    <Ionicons
      name={showChevron ? 'chevron-forward' : 'ellipsis-vertical'}
      size={16}
      color="#C0C0C5"
    />
  </TouchableOpacity>
);

// ─── Profile Screen ───────────────────────────────────────────────────────────
export const ProfileScreen: React.FC = () => {
  const { user, updateProfileName, refreshProfile, logout, isLoading } = useAuth();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Load fresh profile on mount
  useEffect(() => {
    refreshProfile();
  }, []);

  const userName = user?.name || 'Buna User';
  const userPhone = user?.phone || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const balance = user?.balance ?? 0;

  // ── Open Edit Modal ──────────────────────────────────────────────────────
  const handleOpenEdit = () => {
    setEditName(userName === 'Buna User' ? '' : userName);
    setEditModalVisible(true);
  };

  // ── Save Profile Name ─────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfileName(trimmed);
      setEditModalVisible(false);
      Alert.alert('Success', 'Your name has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update name.');
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    await refreshProfile();
    Alert.alert('Refreshed', 'Profile and balance updated.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={TEXT_MUTED} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── AVATAR + NAME ── */}
        <View style={styles.profileHeader}>
          {/* Avatar with initial */}
          <TouchableOpacity style={styles.avatarCircle} onPress={handleOpenEdit} activeOpacity={0.8}>
            <Text style={styles.avatarInitial}>{userInitial}</Text>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userPhone}>{userPhone}</Text>

          {/* Balance Badge */}
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceBadgeLabel}>Wallet Balance</Text>
            <Text style={styles.balanceBadgeAmount}>
              {balance.toLocaleString('en-ET', { minimumFractionDigits: 2 })} Birr
            </Text>
          </View>
        </View>

        {/* ── DIVIDER ── */}
        <View style={styles.divider} />

        {/* ── SETTINGS LIST ── */}
        <View style={styles.settingsList}>
          <SettingRow
            icon="person-outline"
            title="Edit Profile Name"
            subtitle={userName}
            onPress={handleOpenEdit}
            showChevron
          />
          <View style={styles.listDivider} />
          <SettingRow
            icon="language-outline"
            title="Language"
            subtitle="English"
            showChevron
          />
          <View style={styles.listDivider} />
          <SettingRow
            icon="shield-checkmark-outline"
            title="Security"
            subtitle="PIN code, fingerprint"
            showChevron
          />
          <View style={styles.listDivider} />
          <SettingRow
            icon="help-circle-outline"
            title="Customer Support"
            subtitle="Contact Us"
          />
        </View>

        {/* ── VERSION ── */}
        <Text style={styles.version}>Version 2.1.4</Text>

        {/* ── LOGOUT ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── EDIT NAME MODAL ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Your Name</Text>
            <Text style={styles.modalSubtitle}>
              This name will appear on your profile and wallet.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor="#A0A0A5"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, !editName.trim() && styles.modalSaveBtnDisabled]}
                onPress={handleSaveName}
                disabled={saving || !editName.trim()}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 110 },

  // Header
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: TEXT_DARK },

  // Profile Header
  profileHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#E8D9A0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: GOLD_DARK },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: WHITE,
  },
  userName: { fontSize: 18, fontWeight: '700', color: GOLD, marginBottom: 4 },
  userPhone: { fontSize: 14, color: TEXT_MUTED, marginBottom: 16 },
  balanceBadge: {
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceBadgeLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 4 },
  balanceBadgeAmount: { fontSize: 18, fontWeight: '800', color: TEXT_DARK },

  // Divider
  divider: { height: 1, backgroundColor: '#E5E5EA', marginBottom: 8 },

  // Settings
  settingsList: { backgroundColor: WHITE, marginBottom: 24 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },
  settingTitle: { fontSize: 15, fontWeight: '600', color: TEXT_DARK, marginBottom: 2 },
  settingSubtitle: { fontSize: 12, color: TEXT_MUTED },
  listDivider: { height: 1, backgroundColor: '#F0F0F2', marginLeft: 70 },

  // Version
  version: { textAlign: 'center', fontSize: 13, color: '#C0C0C5', marginBottom: 32 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 20,
  },
  logoutText: { fontSize: 15, color: '#FF3B30', fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: TEXT_DARK, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: TEXT_MUTED, marginBottom: 24, lineHeight: 20 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
    marginBottom: 24,
    backgroundColor: '#FAFAF8',
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: BG,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: TEXT_MUTED },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: '#E8D9A0' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
