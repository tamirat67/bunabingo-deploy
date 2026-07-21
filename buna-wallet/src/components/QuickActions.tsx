import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';

interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bg?: string;
  badge?: string;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  label,
  onPress,
  color = Colors.secondary,
  bg = 'rgba(245, 176, 65, 0.12)',
  badge,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={24} color={color} />
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
};

interface QuickActionsRowProps {
  actions: QuickActionProps[];
}

export const QuickActionsRow: React.FC<QuickActionsRowProps> = ({ actions }) => (
  <View style={styles.row}>
    {actions.map((action, i) => (
      <QuickAction key={i} {...action} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  container: {
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  label: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: Typography.weight.bold,
  },
});
