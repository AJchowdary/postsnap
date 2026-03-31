import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, GradientColors, Shadows } from '../constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  variant?: 'gradient' | 'outline' | 'ghost';
}

export default function PrimaryButton({ title, onPress, loading, disabled, testID, icon, variant = 'gradient' }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  const inner = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={Colors.textOnPrimary} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.text,
              variant === 'outline' && styles.textOutline,
              variant === 'ghost' && styles.textGhost,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.75}
        style={[styles.outline, isDisabled && styles.disabled]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.75}
        style={[styles.ghost, isDisabled && styles.disabled]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[styles.wrap, isDisabled && styles.disabled]}
    >
      <LinearGradient
        colors={GradientColors.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {inner}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: BorderRadius.button,
    overflow: 'hidden',
    ...Shadows.primary,
    minHeight: 52,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  outline: {
    borderRadius: BorderRadius.button,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    minHeight: 52,
    ...Shadows.sm,
  },
  ghost: {
    borderRadius: BorderRadius.button,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  disabled: { opacity: 0.45 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { marginRight: 2 },
  text: {
    fontSize: 16,
    color: Colors.textOnPrimary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textOutline: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  textGhost: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
