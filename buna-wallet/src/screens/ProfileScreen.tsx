import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';
import { BunaModal } from '../components/BunaModal';
import { ChangePinModal } from '../components/ChangePinModal';

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
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
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

  // BunaModal states
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [successModal, setSuccessModal] = useState({ visible: false, message: '' });
  const [errorModal, setErrorModal] = useState({ visible: false, message: '' });

  // Change PIN state
  const [changePinVisible, setChangePinVisible] = useState(false);

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
      setErrorModal({ visible: true, message: 'Name cannot be empty.' });
      return;
    }
    setSaving(true);
    try {
      await updateProfileName(trimmed);
      setEditModalVisible(false);
      setSuccessModal({ visible: true, message: 'Your profile name has been updated!' });
    } catch (err: any) {
      setErrorModal({ visible: true, message: err.message || 'Failed to update name.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    await refreshProfile();
    Alert.alert('Refreshed', 'Profile and balance updated.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.secondary} />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── AVATAR + NAME ── */}
        <View style={styles.profileHeader}>
          {/* Buna Wallet Logo + user avatar ring */}
          <TouchableOpacity style={styles.avatarCircle} onPress={handleOpenEdit} activeOpacity={0.8}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.avatarLogo}
              resizeMode="contain"
            />
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
            subtitle="Change PIN code"
            onPress={() => setChangePinVisible(true)}
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

      {/* ── Logout Confirm Modal ── */}
      <BunaModal
        visible={logoutModalVisible}
        variant="confirm"
        title="Log Out?"
        message="You will need to enter your PIN or verify again to log back in."
        primaryLabel="Log Out"
        secondaryLabel="Stay"
        onPrimary={() => { setLogoutModalVisible(false); logout(); }}
        onSecondary={() => setLogoutModalVisible(false)}
        onClose={() => setLogoutModalVisible(false)}
      />

      {/* ── Success Modal ── */}
      <BunaModal
        visible={successModal.visible}
        variant="success"
        title="Updated!"
        message={successModal.message}
        primaryLabel="Great"
        onPrimary={() => setSuccessModal({ visible: false, message: '' })}
        onClose={() => setSuccessModal({ visible: false, message: '' })}
      />

      {/* ── Error Modal ── */}
      <BunaModal
        visible={errorModal.visible}
        variant="error"
        title="Something went wrong"
        message={errorModal.message}
        primaryLabel="Got it"
        onPrimary={() => setErrorModal({ visible: false, message: '' })}
        onClose={() => setErrorModal({ visible: false, message: '' })}
      />

      {/* ── Change PIN Modal ── */}
      <ChangePinModal
        visible={changePinVisible}
        onClose={() => setChangePinVisible(false)}
        onSuccess={() => setSuccessModal({ visible: true, message: 'Your PIN has been successfully changed.' })}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },

  // Profile Header
  profileHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: Colors.secondary,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
    ...(Shadows.card as any),
  },
  avatarLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.backgroundAlt,
  },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  userPhone: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  balanceBadge: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    ...(Shadows.card as any),
  },
  balanceBadgeLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  balanceBadgeAmount: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  // Divider
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 8 },

  // Settings
  settingsList: { backgroundColor: Colors.backgroundAlt, marginBottom: 24, ...(Shadows.sm as any), borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
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
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  settingTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  settingSubtitle: { fontSize: 12, color: Colors.textSecondary },
  listDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 70 },

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
    backgroundColor: 'rgba(30,20,15,0.6)', // Espresso tint
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.backgroundAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: Colors.borderActive,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 24,
    backgroundColor: Colors.background,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: Colors.primaryDark, opacity: 0.5 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: Colors.secondaryLight },
});
