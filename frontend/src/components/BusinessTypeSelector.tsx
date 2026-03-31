import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, GradientColors } from '../constants/theme';
import type { BusinessType } from '../types';
import {
  QUICK_PICK_ITEMS,
  FULL_BUSINESS_CATALOG,
  type CatalogItem,
  titleCaseDisplay,
  inferAiCategoryFromText,
  inferCustomDescriptionHint,
} from '../constants/businessTypeCatalog';

export type BusinessTypeSelection = {
  type: BusinessType;
  displayType: string;
  customDescription: string;
};

type Props = {
  variant: 'modal' | 'inline';
  value: BusinessTypeSelection;
  /** Fires when selection is confirmed (modal) or whenever it changes (inline). */
  onChange: (v: BusinessTypeSelection) => void;
  visible?: boolean;
  onClose?: () => void;
  title?: string;
};

function selectionFromCatalogItem(item: CatalogItem): BusinessTypeSelection {
  return {
    type: item.aiCategory,
    displayType: item.label,
    customDescription: '',
  };
}

function filterCatalog(q: string, list: CatalogItem[]): CatalogItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter(
    (it) =>
      it.label.toLowerCase().includes(s) ||
      it.group.toLowerCase().includes(s) ||
      it.emoji.includes(q.trim())
  );
}

const GROUP_ORDER = [
  'FOOD & BEVERAGE',
  'BEAUTY & WELLNESS',
  'RETAIL & SHOPPING',
  'SERVICES & PROFESSIONAL',
  'ENTERTAINMENT & HOSPITALITY',
  'OTHER',
];

export function BusinessTypeSelector({
  variant,
  value,
  onChange,
  visible = false,
  onClose,
  title = 'Business type',
}: Props) {
  const [draft, setDraft] = useState<BusinessTypeSelection>(value);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (variant === 'modal' && visible) {
      setDraft(value);
      setSearch('');
      setShowAll(false);
    }
  }, [variant, visible, value]);

  useEffect(() => {
    if (variant === 'inline') setDraft(value);
  }, [variant, value]);

  const filteredFull = useMemo(() => filterCatalog(search, FULL_BUSINESS_CATALOG), [search]);
  const filteredQuick = useMemo(() => filterCatalog(search, QUICK_PICK_ITEMS), [search]);

  const showCustomPrompt =
    search.trim().length >= 2 && filteredFull.length === 0;

  const applyCatalog = (item: CatalogItem) => {
    const next = selectionFromCatalogItem(item);
    setDraft(next);
    if (variant === 'inline') onChange(next);
  };

  const confirmCustom = () => {
    const raw = search.trim();
    if (raw.length < 2) return;
    const display = titleCaseDisplay(raw);
    const ai = inferAiCategoryFromText(raw);
    const customDescription = inferCustomDescriptionHint(raw, ai);
    const next: BusinessTypeSelection = {
      type: ai,
      displayType: display,
      customDescription,
    };
    setDraft(next);
    if (variant === 'inline') onChange(next);
    setSearch('');
  };

  const handleModalConfirm = () => {
    onChange(draft);
    onClose?.();
  };

  const isSelected = (item: CatalogItem) =>
    draft.displayType === item.label && draft.type === item.aiCategory && !draft.customDescription;

  const body = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search or type your business type…"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="words"
          autoCorrect
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showCustomPrompt && (
        <View style={styles.customBanner}>
          <Text style={styles.customBannerText}>
            We&apos;ll set up AI for:{' '}
            <Text style={styles.customBannerBold}>{titleCaseDisplay(search.trim())}</Text>
          </Text>
          <TouchableOpacity onPress={confirmCustom} activeOpacity={0.85} style={styles.customConfirmSmall}>
            <Text style={styles.customConfirmSmallText}>Use this type</Text>
          </TouchableOpacity>
        </View>
      )}

      {!showAll && (
        <>
          <Text style={styles.groupHeader}>Quick picks</Text>
          <View style={styles.pillRow}>
            {filteredQuick.map((item) => {
              const sel = isSelected(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  testID={`quick-pick-${item.id}`}
                  onPress={() => applyCatalog(item)}
                  activeOpacity={0.85}
                  style={[styles.pill, sel && styles.pillSelected]}
                >
                  <Text style={styles.pillEmoji}>{item.emoji}</Text>
                  <Text style={[styles.pillLabel, sel && styles.pillLabelSelected]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => setShowAll(true)} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>See all types</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </>
      )}

      {showAll && (
        <TouchableOpacity onPress={() => setShowAll(false)} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>Show fewer</Text>
          <Ionicons name="chevron-up" size={18} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {(showAll || search.trim().length > 0) && (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {GROUP_ORDER.map((group) => {
            const items = (search.trim() ? filteredFull : FULL_BUSINESS_CATALOG).filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <View key={group} style={styles.groupBlock}>
                <Text style={styles.groupHeader}>{group}</Text>
                {items.map((item) => {
                  const sel = isSelected(item);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      testID={`catalog-${item.id}`}
                      style={[styles.row, sel && styles.rowSelected]}
                      onPress={() => applyCatalog(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.rowEmoji}>{item.emoji}</Text>
                      <Text style={[styles.rowLabel, sel && styles.rowLabelSelected]}>{item.label}</Text>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {variant === 'modal' && (
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleModalConfirm} activeOpacity={0.9} style={styles.confirmOuter}>
            <LinearGradient
              colors={GradientColors.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmGrad}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  if (variant === 'inline') {
    return (
      <View style={styles.inlineWrap}>
        {body}
        <View style={styles.selectedPreview}>
          <Text style={styles.previewLabel}>Selected</Text>
          <View style={styles.previewPill}>
            <Text style={styles.previewText}>{draft.displayType}</Text>
          </View>
          {!!draft.customDescription && (
            <Text style={styles.previewHint} numberOfLines={3}>
              {draft.customDescription}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeHit}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{title}</Text>
              <View style={{ width: 40 }} />
            </View>
            {body}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSafe: { maxHeight: '92%' },
  modalCard: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flex: 1,
    minHeight: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  closeHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 16 },
  customBanner: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.input,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customBannerText: { color: Colors.primaryDark, fontSize: 14, lineHeight: 20 },
  customBannerBold: { fontWeight: '800', color: Colors.textPrimary },
  customConfirmSmall: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  customConfirmSmallText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 13 },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '100%',
  },
  pillSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  pillEmoji: { fontSize: 16 },
  pillLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, maxWidth: 200 },
  pillLabelSelected: { color: Colors.primaryDark },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, marginBottom: 8 },
  seeAllText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  listScroll: { flexGrow: 0, maxHeight: 320 },
  listContent: { paddingBottom: 16 },
  groupBlock: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.input,
    marginBottom: 4,
    backgroundColor: Colors.bgElevated,
  },
  rowSelected: { backgroundColor: Colors.primaryLight },
  rowEmoji: { fontSize: 20 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowLabelSelected: { color: Colors.primaryDark },
  footer: { paddingTop: 8, paddingBottom: 4 },
  confirmOuter: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  confirmGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: 16, fontWeight: '800', color: Colors.textOnPrimary },
  inlineWrap: { width: '100%' },
  selectedPreview: { marginTop: 12, gap: 8 },
  previewLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  previewPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
  },
  previewText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  previewHint: { fontSize: 12, color: Colors.textTertiary, lineHeight: 17 },
});
