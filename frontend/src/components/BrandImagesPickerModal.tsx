import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useAppStore } from '../store/appStore';

const { width: SCREEN_W } = Dimensions.get('window');
const PAD = Spacing.lg;
const GAP = Spacing.sm;
const COLS = 3;
const CELL = (SCREEN_W - PAD * 2 - GAP * (COLS - 1)) / COLS;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with selected image URIs (http(s), data URLs, etc.). */
  onImagesSelected: (uris: string[]) => void;
  maxSelectable: number;
};

export default function BrandImagesPickerModal({
  visible,
  onClose,
  onImagesSelected,
  maxSelectable,
}: Props) {
  const businessProfile = useAppStore((s) => s.businessProfile);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const raw: { uri: string; id: string; label: string }[] = [];
    const logo = businessProfile.logo?.trim();
    if (logo) {
      raw.push({ uri: logo, id: 'logo', label: 'Logo' });
    }
    (businessProfile.photoStyleExamples || []).forEach((uri, i) => {
      const u = uri?.trim();
      if (u) raw.push({ uri: u, id: `ref-${i}`, label: `Reference ${i + 1}` });
    });
    const seen = new Set<string>();
    return raw.filter((x) => {
      if (seen.has(x.uri)) return false;
      seen.add(x.uri);
      return true;
    });
  }, [businessProfile.logo, businessProfile.photoStyleExamples]);

  useEffect(() => {
    if (!visible) setSelected(new Set());
  }, [visible]);

  const toggle = (uri: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else if (next.size < maxSelectable) next.add(uri);
      return next;
    });
  };

  const handleDone = () => {
    onImagesSelected(Array.from(selected));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Brand images</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Cancel">
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.counter}>
              {selected.size} selected
              {maxSelectable > 0 ? ` · up to ${maxSelectable}` : ''}
            </Text>
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                  No brand images yet. Add a logo or reference images in Brand DNA.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
              >
                {items.map((it) => {
                  const on = selected.has(it.uri);
                  return (
                    <TouchableOpacity
                      key={it.id}
                      style={styles.cell}
                      onPress={() => toggle(it.uri)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: it.uri }} style={styles.thumb} resizeMode="cover" />
                      {on && (
                        <View style={styles.checkOverlay} pointerEvents="none">
                          <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={18} color={Colors.white} />
                          </View>
                        </View>
                      )}
                      <Text style={styles.cellLabel} numberOfLines={1}>
                        {it.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.doneBtn, selected.size === 0 && styles.doneBtnDisabled]}
              onPress={handleDone}
              disabled={selected.size === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay55,
    justifyContent: 'flex-end',
  },
  safe: { maxHeight: Platform.OS === 'web' ? '90%' : '88%' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: PAD,
    paddingBottom: Spacing.lg,
    maxHeight: '100%',
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { ...Typography.h4, color: Colors.textPrimary },
  cancelText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  counter: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  scroll: { maxHeight: 360 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingBottom: Spacing.md,
  },
  cell: { width: CELL, marginBottom: Spacing.xs },
  thumb: {
    width: CELL,
    height: CELL * 1.15,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  doneBtnDisabled: { opacity: 0.45 },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textOnPrimary },
});
