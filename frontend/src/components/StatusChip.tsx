import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Typography } from '../constants/theme';
import { SubscriptionStatus } from '../types';

interface StatusChipProps {
  status: SubscriptionStatus;
  daysLeft?: number;
  postsLeft?: number;
  size?: 'sm' | 'md';
  testID?: string;
}

export default function StatusChip({ status, daysLeft, postsLeft, size = 'sm', testID }: StatusChipProps) {
  const config = getConfig(status, daysLeft, postsLeft);
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: config.bg }, size === 'md' && styles.chipMd]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, size === 'md' && styles.textMd]}>
        {config.label}
      </Text>
    </View>
  );
}

function getConfig(status: SubscriptionStatus, daysLeft?: number, postsLeft?: number) {
  if (status === 'subscribed') {
    return { bg: Colors.successLight, color: '#16a34a', label: 'Subscribed' };
  }
  if (status === 'expired') {
    return { bg: Colors.errorLight, color: Colors.error, label: 'Trial ended' };
  }
  // trial
  if (daysLeft !== undefined && daysLeft <= 0) {
    return { bg: Colors.errorLight, color: Colors.error, label: 'Trial ended' };
  }
  const label = daysLeft !== undefined ? `Trial: ${daysLeft}d left` : 'Trial';
  const isUrgent = daysLeft !== undefined && daysLeft <= 2;
  return {
    bg: isUrgent ? Colors.errorLight : Colors.warningLight,
    color: isUrgent ? Colors.error : Colors.warning,
    label,
  };
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 5,
  },
  chipMd: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textMd: {
    fontSize: 13,
  },
});
