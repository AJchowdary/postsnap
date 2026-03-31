import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/theme';
import { AI_INLINE_DISCLAIMER } from '../constants/aiDisclaimer';

type Props = {
  /** Tighter vertical margin when stacked under compact controls */
  compact?: boolean;
};

export default function AiDisclaimer({ compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} style={styles.icon} />
      <Text style={styles.text} accessibilityLabel={AI_INLINE_DISCLAIMER}>
        {AI_INLINE_DISCLAIMER}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: 2,
  },
  wrapCompact: {
    marginTop: Spacing.sm,
  },
  icon: { marginTop: 2 },
  text: {
    ...Typography.caption,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
