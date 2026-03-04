import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../constants/theme';
import { ToastMessage } from '../types';

interface ToastProps {
  toast: ToastMessage;
  onHide: () => void;
}

export default function Toast({ toast, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, [toast.id]);

  const config = {
    success: { bg: '#052e16', icon: 'checkmark-circle' as const, iconColor: Colors.success },
    error: { bg: '#450a0a', icon: 'close-circle' as const, iconColor: Colors.error },
    info: { bg: '#1e1327', icon: 'information-circle' as const, iconColor: Colors.primary },
  }[toast.type];

  return (
    <Animated.View
      testID="toast-message"
      style={[styles.container, { backgroundColor: config.bg, opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
      <TouchableOpacity onPress={onHide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: BorderRadius.xl,
    zIndex: 9999,
    ...Shadows.md,
  },
  message: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
