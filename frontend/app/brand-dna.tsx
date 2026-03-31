import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import { updateBusinessProfile, scanWebsite } from '../src/services/api';
import type { BrandVibe, BusinessProfile, ToneOfVoice, VisualStyle } from '../src/types';
import { businessProfileToApiPayload } from '../src/utils/brandDnaPayload';
import PrimaryButton from '../src/components/PrimaryButton';

const TONE_OPTIONS: { id: ToneOfVoice; label: string }[] = [
  { id: 'casual', label: 'Casual' },
  { id: 'professional', label: 'Professional' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'inspiring', label: 'Inspiring' },
  { id: 'bold', label: 'Bold' },
];

const VISUAL_OPTIONS: { id: VisualStyle; label: string }[] = [
  { id: 'photo-real', label: 'Photo-real' },
  { id: 'illustrated', label: 'Illustrated' },
  { id: 'bold-graphic', label: 'Bold graphic' },
  { id: 'lifestyle', label: 'Lifestyle' },
];

const VIBE_LABEL: Record<BrandVibe, string> = {
  professional: 'Professional',
  bold: 'Bold',
  warm: 'Warm',
};

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function BrandDnaScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const showToast = useAppStore((s) => s.showToast);

  const [draft, setDraft] = useState<BusinessProfile>(businessProfile);
  const [saving, setSaving] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const [addTraitOpen, setAddTraitOpen] = useState(false);
  const [traitInput, setTraitInput] = useState('');
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      setDraft(businessProfile);
    }, [businessProfile])
  );

  const persist = async (next: BusinessProfile) => {
    setDraft(next);
    setBusinessProfile(next);
    setSaving(true);
    try {
      await updateBusinessProfile(businessProfileToApiPayload(next));
    } catch {
      showToast('Saved locally — sync when online', 'info');
    } finally {
      setSaving(false);
    }
  };

  const patch = (partial: Partial<BusinessProfile>) => {
    void persist({ ...draft, ...partial });
  };

  const textTraits = useMemo(() => {
    const vibeLabels = new Set(Object.values(VIBE_LABEL));
    const raw = (draft.uniqueDifferentiator || '')
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !vibeLabels.has(s));
    return [...new Set(raw)];
  }, [draft.uniqueDifferentiator]);

  const confidence = draft.confidenceOverall ?? 0.65;
  const confPct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);

  const handleRescan = async () => {
    const url = (draft.websiteUrl || '').trim();
    if (!url) {
      showToast('Add a website URL first', 'error');
      return;
    }
    setScanBusy(true);
    try {
      const { account } = await scanWebsite(url);
      const a = account as Record<string, unknown>;
      const next: BusinessProfile = {
        ...draft,
        name: (a.name as string) || draft.name,
        type: (a.type as BusinessProfile['type']) || draft.type,
        displayType: (a.displayType as string) || draft.displayType,
        customDescription: (a.customDescription as string) ?? draft.customDescription,
        city: (a.city as string) || draft.city,
        brandColor: (a.brandColor as string) || draft.brandColor,
        brandVibe: (a.brandVibe as BrandVibe) || draft.brandVibe,
        dominantColors: (a.dominantColors as string[]) ?? draft.dominantColors,
        websiteUrl: (a.websiteUrl as string) || draft.websiteUrl,
        websiteSummary: (a.websiteSummary as string) || draft.websiteSummary,
        toneExample: (a.toneExample as string) || draft.toneExample,
        instagramHandle: (a.instagramHandle as string) || draft.instagramHandle,
        brandDnaSource: 'website',
      };
      await persist(next);
      showToast('Website rescanned', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Scan failed', 'error');
    } finally {
      setScanBusy(false);
    }
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Photo library access is needed', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    if (uri.length > 1_200_000) {
      showToast('Image too large — try a smaller file', 'error');
      return;
    }
    patch({ logo: uri });
  };

  const addReferenceImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    const list = [...(draft.photoStyleExamples || [])];
    if (list.length >= 20) {
      showToast('Maximum 20 reference images', 'error');
      return;
    }
    if (uri.length > 900_000) {
      showToast('Image too large', 'error');
      return;
    }
    list.push(uri);
    patch({ photoStyleExamples: list });
  };

  const addImageByUrl = () => {
    const u = imageUrlInput.trim();
    if (!u.startsWith('http')) {
      showToast('Enter a valid image URL', 'error');
      return;
    }
    const list = [...(draft.photoStyleExamples || [])];
    if (list.length >= 20) {
      showToast('Maximum 20 images', 'error');
      return;
    }
    list.push(u);
    patch({ photoStyleExamples: list });
    setImageUrlInput('');
    setUrlModalOpen(false);
  };

  const removeImageAt = (index: number) => {
    const list = [...(draft.photoStyleExamples || [])];
    list.splice(index, 1);
    patch({ photoStyleExamples: list });
  };

  const removeTrait = (label: string, isVibe: boolean) => {
    if (isVibe) {
      patch({ brandVibe: undefined });
      return;
    }
    const remaining = textTraits.filter((t) => t !== label);
    patch({ uniqueDifferentiator: remaining.join(', ') });
  };

  const addTrait = () => {
    const t = traitInput.trim();
    if (!t) return;
    const prev = draft.uniqueDifferentiator?.trim();
    patch({ uniqueDifferentiator: prev ? `${prev}, ${t}` : t });
    setTraitInput('');
    setAddTraitOpen(false);
  };

  const visualLabel =
    VISUAL_OPTIONS.find((o) => o.id === draft.visualStyle)?.label ?? 'Not set';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brand DNA</Text>
        {saving ? (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.headerRight} />
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionTitle>IDENTITY</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={styles.input}
            value={draft.name}
            onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            onEndEditing={(e) =>
              patch({ name: e.nativeEvent.text.trim() || businessProfile.name })
            }
            placeholder="Your business"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Website URL</Text>
          <View style={styles.rowGap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={draft.websiteUrl || ''}
              onChangeText={(websiteUrl) => setDraft((d) => ({ ...d, websiteUrl }))}
              onEndEditing={(e) =>
              patch({ websiteUrl: e.nativeEvent.text.trim() || undefined })
            }
              placeholder="https://"
              autoCapitalize="none"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.outlineBtn, scanBusy && { opacity: 0.6 }]}
              onPress={handleRescan}
              disabled={scanBusy}
            >
              {scanBusy ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Text style={styles.outlineBtnText}>Re-scan</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Logo</Text>
          <View style={styles.logoRow}>
            {draft.logo ? (
              <Image source={{ uri: draft.logo }} style={styles.logoImg} resizeMode="cover" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
              </View>
            )}
            <TouchableOpacity style={styles.outlineBtn} onPress={pickLogo}>
              <Text style={styles.outlineBtnText}>{draft.logo ? 'Replace' : 'Upload'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionTitle>VISUAL IDENTITY</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.label}>Brand colors</Text>
          <View style={styles.swatchRow}>
            {draft.brandColor && (
              <View style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: draft.brandColor }]} />
                <Text style={styles.hex}>{draft.brandColor}</Text>
              </View>
            )}
            {(draft.dominantColors || []).map((hex) => (
              <View key={hex} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: hex }]} />
                <Text style={styles.hex}>{hex}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>Primary color is editable in Settings; scan updates swatches.</Text>
          <Text style={styles.label}>Type pairing</Text>
          <Text style={styles.bodyMuted}>
            Clean sans-serif stack recommended for {visualLabel.toLowerCase()} aesthetics (system / Inter-class
            fonts).
          </Text>
          <Text style={styles.label}>Visual style</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setVisualOpen(true)}>
            <Text style={styles.selectBtnText}>{visualLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <SectionTitle>BRAND PERSONALITY</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.label}>Tagline</Text>
          <TextInput
            style={styles.input}
            value={draft.tagline || ''}
            onChangeText={(tagline) => setDraft((d) => ({ ...d, tagline }))}
            onEndEditing={(e) => patch({ tagline: e.nativeEvent.text.trim() || undefined })}
            placeholder="Short line that defines you"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Brand vibe</Text>
          <View style={styles.vibeRow}>
            {(['professional', 'bold', 'warm'] as BrandVibe[]).map((v) => {
              const on = draft.brandVibe === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.vibeChip, on && styles.vibeChipOn]}
                  onPress={() => patch({ brandVibe: v })}
                >
                  <Text style={[styles.vibeChipText, on && styles.vibeChipTextOn]}>{VIBE_LABEL[v]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Tone of voice</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setToneOpen(true)}>
            <Text style={styles.selectBtnText}>
              {TONE_OPTIONS.find((t) => t.id === draft.toneOfVoice)?.label ?? 'Choose tone'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.label}>Content persona</Text>
          <TextInput
            style={[styles.input, { minHeight: 72 }]}
            multiline
            value={draft.contentPersona || ''}
            onChangeText={(contentPersona) => setDraft((d) => ({ ...d, contentPersona }))}
            onEndEditing={(e) =>
              patch({ contentPersona: e.nativeEvent.text.trim() || undefined })
            }
            placeholder="Who is speaking to your audience?"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Business overview</Text>
          <TextInput
            style={[styles.input, { minHeight: 100 }]}
            multiline
            value={draft.websiteSummary || ''}
            onChangeText={(websiteSummary) => setDraft((d) => ({ ...d, websiteSummary }))}
            onEndEditing={(e) =>
              patch({ websiteSummary: e.nativeEvent.text.trim() || undefined })
            }
            placeholder="What you do, who you serve, what makes you different"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <SectionTitle>BRAND VALUES</SectionTitle>
        <View style={styles.card}>
          <View style={styles.traitWrap}>
            {draft.brandVibe && (
              <TouchableOpacity
                style={styles.traitPill}
                onPress={() => removeTrait(VIBE_LABEL[draft.brandVibe!], true)}
              >
                <Text style={styles.traitText}>{VIBE_LABEL[draft.brandVibe!]}</Text>
                <Ionicons name="close" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {textTraits.map((t) => (
              <TouchableOpacity key={t} style={styles.traitPill} onPress={() => removeTrait(t, false)}>
                <Text style={styles.traitText}>{t}</Text>
                <Ionicons name="close" size={14} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.addTraitBtn} onPress={() => setAddTraitOpen(true)}>
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addTraitText}>Add trait</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle>BRAND IMAGES</SectionTitle>
        <View style={styles.card}>
          <View style={styles.imgGrid}>
            {(draft.photoStyleExamples || []).map((uri, i) => (
              <View key={`${i}-${uri.slice(0, 24)}`} style={styles.imgCell}>
                <Image source={{ uri }} style={styles.gridImg} resizeMode="cover" />
                <TouchableOpacity style={styles.imgRemove} onPress={() => removeImageAt(i)}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.imgActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={addReferenceImage}>
              <Text style={styles.outlineBtnText}>Upload image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setUrlModalOpen(true)}>
              <Text style={styles.outlineBtnText}>Add URL</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionTitle>CONFIDENCE</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.confTitle}>Brand DNA strength</Text>
          <View style={styles.meterBg}>
            <View style={[styles.meterFill, { width: `${confPct}%` }]} />
          </View>
          <Text style={styles.confPct}>{confPct}%</Text>
          {confidence < 0.6 && (
            <Text style={styles.confHint}>Add more details to improve your content</Text>
          )}
          {confidence > 0.8 && <Text style={styles.confGood}>Your Brand DNA is strong</Text>}
          {confidence >= 0.6 && confidence <= 0.8 && (
            <Text style={styles.bodyMuted}>Keep refining your profile for best results.</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={toneOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setToneOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Tone of voice</Text>
            {TONE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.modalRow}
                onPress={() => {
                  patch({ toneOfVoice: o.id });
                  setToneOpen(false);
                }}
              >
                <Text style={styles.modalRowText}>{o.label}</Text>
                {draft.toneOfVoice === o.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={visualOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setVisualOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Visual style</Text>
            {VISUAL_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.modalRow}
                onPress={() => {
                  patch({ visualStyle: o.id });
                  setVisualOpen(false);
                }}
              >
                <Text style={styles.modalRowText}>{o.label}</Text>
                {draft.visualStyle === o.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addTraitOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New trait</Text>
            <TextInput
              style={styles.input}
              value={traitInput}
              onChangeText={setTraitInput}
              placeholder="e.g. Family-owned"
              placeholderTextColor={Colors.textMuted}
            />
            <PrimaryButton title="Add" onPress={addTrait} />
            <TouchableOpacity onPress={() => setAddTraitOpen(false)} style={{ marginTop: 8 }}>
              <Text style={{ textAlign: 'center', color: Colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={urlModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={imageUrlInput}
              onChangeText={setImageUrlInput}
              placeholder="https://…"
              autoCapitalize="none"
              placeholderTextColor={Colors.textMuted}
            />
            <PrimaryButton title="Add" onPress={addImageByUrl} />
            <TouchableOpacity onPress={() => setUrlModalOpen(false)} style={{ marginTop: 8 }}>
              <Text style={{ textAlign: 'center', color: Colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  backHit: { padding: 4 },
  headerTitle: { ...Typography.h3, flex: 1, textAlign: 'center', marginRight: 28 },
  headerRight: { width: 28 },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxl },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outlineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  logoImg: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.border },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchItem: { alignItems: 'center', gap: 4 },
  swatch: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong },
  hex: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  bodyMuted: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  selectBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  vibeChipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  vibeChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  vibeChipTextOn: { color: Colors.primaryDark },
  traitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.35)',
  },
  traitText: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
  addTraitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  addTraitText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  imgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgCell: { width: '30%', aspectRatio: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  gridImg: { width: '100%', height: '100%' },
  imgRemove: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  imgActions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  confTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  meterBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  meterFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 5,
  },
  confPct: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 6 },
  confHint: { fontSize: 13, color: Colors.warning, marginTop: 8, fontWeight: '600' },
  confGood: { fontSize: 13, color: Colors.success, marginTop: 8, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
    padding: Spacing.lg,
    paddingBottom: 32,
  },
  modalTitle: { ...Typography.h4, marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalRowText: { fontSize: 16, color: Colors.textPrimary, fontWeight: '600' },
});
