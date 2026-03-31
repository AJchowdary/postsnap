import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, type ViewStyle } from 'react-native';
import { Colors, BorderRadius, Typography } from '../constants/theme';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'ghost' | 'danger';
  style?: ViewStyle;
}

export default function SecondaryButton({
  title,
  onPress,
  loading,
  disabled,
  testID,
  icon,
  variant = 'default',
  style,
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[styles.button, styles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.textSecondary} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && <View>{icon}</View>}
          <Text style={[styles.text, variant === 'danger' && styles.dangerText]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  default: {
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: 'rgba(108, 99, 255, 0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dangerText: {
    color: Colors.error,
  },
});
