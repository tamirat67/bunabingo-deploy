import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';

export type TransactionType = 'credit' | 'debit' | 'transfer' | 'reward' | 'deposit' | 'withdraw';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  subtitle?: string;
  amount: number;
  currency?: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

const TYPE_CONFIG: Record<TransactionType, { icon: any; color: string; bg: string }> = {
  credit: { icon: 'arrow-down', color: Colors.success, bg: 'rgba(52, 199, 89, 0.1)' },
  debit: { icon: 'arrow-up', color: Colors.danger, bg: 'rgba(255, 59, 48, 0.1)' },
  transfer: { icon: 'swap-horizontal', color: Colors.info, bg: 'rgba(10, 132, 255, 0.1)' },
  reward: { icon: 'gift', color: Colors.secondary, bg: 'rgba(245, 176, 65, 0.1)' },
  deposit: { icon: 'wallet', color: Colors.success, bg: 'rgba(52, 199, 89, 0.1)' },
  withdraw: { icon: 'cash', color: Colors.warning, bg: 'rgba(255, 149, 0, 0.1)' },
};

const STATUS_COLORS = {
  completed: Colors.success,
  pending: Colors.warning,
  failed: Colors.danger,
};

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
}) => {
  const config = TYPE_CONFIG[transaction.type];
  const isPositive = transaction.type === 'credit' || transaction.type === 'reward' || transaction.type === 'deposit';
  const currency = transaction.currency ?? 'ETB';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{transaction.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {transaction.subtitle || transaction.date}
        </Text>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: isPositive ? Colors.success : Colors.textPrimary }]}>
          {isPositive ? '+' : '-'} {currency} {Math.abs(transaction.amount).toLocaleString('en-ET', { minimumFractionDigits: 2 })}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[transaction.status] }]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textMuted,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    alignSelf: 'flex-end',
  },
});
