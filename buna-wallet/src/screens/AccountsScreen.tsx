import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../theme/colors';
import { Shadows } from '../theme/tokens';

export const AccountsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitleBlack}>Linked </Text>
          <Text style={styles.headerTitleGold}>Accounts</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Placeholder for Illustration */}
        <View style={styles.illustrationPlaceholder}>
          <Ionicons name="wallet-outline" size={100} color="#D0D0D5" />
        </View>

        <Text style={styles.emptyText}>
          No linked accounts yet. Link now{'\n'}and they will appear here.
        </Text>

        <TouchableOpacity style={[styles.linkBtn, Shadows.gold as any]} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={Colors.textInverse} style={styles.linkBtnIcon} />
          <Text style={styles.linkBtnText}>Link Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleBlack: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerTitleGold: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.secondary,
  },
  addBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  illustrationPlaceholder: {
    marginBottom: 30,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  linkBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  linkBtnIcon: {
    marginRight: 8,
  },
  linkBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
