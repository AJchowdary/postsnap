import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

const PHASES = [
  'Connecting to your site…',
  'Studying brand values & positioning…',
  'Pulling colors & reference images…',
  'Learning tone of voice…',
  'Almost there…',
] as const;

/** Normalize user input into a previewable https URL, or null if invalid. */
export function normalizeWebsitePreviewUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^(javascript|data|vbscript):/i.test(t)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:\/\//i.test(t)) return null;
  try {
    const href = t.includes('://') ? t : `https://${t}`;
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

export function hostnameLabel(raw: string): string {
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.hostname;
  } catch {
    return raw.trim() || 'your site';
  }
}

type Props = {
  visible: boolean;
  urlRaw: string;
  onCancel: () => void;
};

/**
 * Full-screen Pomelli-style “Building Business DNA” experience: live site preview,
 * rotating status phases, and cancel.
 */
function ScanCornerBrackets({ color }: { color: string }) {
  const w = 3;
  const L = 22;
  const inset = 10;
  const base = {
    position: 'absolute' as const,
    borderColor: color,
  };
  return (
    <>
      <View
        style={[base, { top: inset, left: inset, width: L, height: L, borderTopWidth: w, borderLeftWidth: w }]}
      />
      <View
        style={[base, { top: inset, right: inset, width: L, height: L, borderTopWidth: w, borderRightWidth: w }]}
      />
      <View
        style={[
          base,
          { bottom: inset, left: inset, width: L, height: L, borderBottomWidth: w, borderLeftWidth: w },
        ]}
      />
      <View
        style={[
          base,
          { bottom: inset, right: inset, width: L, height: L, borderBottomWidth: w, borderRightWidth: w },
        ]}
      />
    </>
  );
}

export default function WebsiteDnaScanOverlay({ visible, urlRaw, onCancel }: Props) {
  const { height } = useWindowDimensions();
  const previewUrl = useMemo(() => normalizeWebsitePreviewUrl(urlRaw), [urlRaw]);
  const host = useMemo(() => hostnameLabel(urlRaw), [urlRaw]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setPhaseIdx(0);
      return;
    }
    const id = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % PHASES.length);
    }, 2800);
    return () => clearInterval(id);
  }, [visible]);

  const webHeight = Math.min(Math.round(height * 0.38), 320);

  useEffect(() => {
    if (!visible) {
      scanAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, scanAnim, webHeight]);

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, Math.max(12, webHeight - 14)],
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Building your Business DNA</Text>
          <Text style={styles.subtitle}>
            Complex sites can take a minute — hang tight, or cancel and try manual setup.
          </Text>
          <View style={styles.urlPill}>
            <Ionicons name="globe-outline" size={16} color={Colors.primary} />
            <Text style={styles.urlPillText} numberOfLines={1}>
              {host}
            </Text>
          </View>
        </View>

        <View style={[styles.previewWrap, { height: webHeight }]}>
          {previewUrl ? (
            <WebView
              source={{ uri: previewUrl }}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.webLoadingText}>Loading preview…</Text>
                </View>
              )}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={Platform.OS !== 'android'}
            />
          ) : (
            <View style={styles.previewFallback}>
              <Ionicons name="cloud-offline-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.previewFallbackText}>Enter a valid URL to see a live preview</Text>
            </View>
          )}
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={styles.scanVignette} />
            <ScanCornerBrackets color="rgba(108, 99, 255, 0.85)" />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}>
              <View style={styles.scanLineGlow} />
            </Animated.View>
          </View>
        </View>

        <View style={styles.phaseRow}>
          {PHASES.map((_, i) => (
            <View key={i} style={[styles.phaseDot, i === phaseIdx && styles.phaseDotActive]} />
          ))}
        </View>
        <Text style={styles.phaseLabel}>{PHASES[phaseIdx]}</Text>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Text style={styles.hint}>
            We&apos;re analyzing your public pages in the background. You can leave this screen — but
            stay on the app until we finish.
          </Text>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.base,
  },
  header: { gap: 10, marginBottom: Spacing.md },
  title: { ...Typography.h2, marginTop: 4 },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  urlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '100%',
    ...Shadows.sm,
  },
  urlPillText: { ...Typography.body, flex: 1, fontWeight: '600' },
  previewWrap: {
    position: 'relative',
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    ...Shadows.card,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  scanVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 249, 255, 0.06)',
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 3,
    top: 0,
  },
  scanLineGlow: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    opacity: 0.92,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 6,
  },
  webview: { flex: 1, backgroundColor: Colors.paper },
  webLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.paper,
  },
  webLoadingText: { ...Typography.caption, color: Colors.textSecondary },
  previewFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  previewFallbackText: { ...Typography.bodySmall, textAlign: 'center', color: Colors.textMuted },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  phaseDotActive: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.25 }],
  },
  phaseLabel: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontWeight: '600',
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
  },
  spacer: { flex: 1, minHeight: Spacing.md },
  footer: { paddingBottom: Spacing.lg, gap: Spacing.md },
  hint: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  cancelBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  cancelText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
});
