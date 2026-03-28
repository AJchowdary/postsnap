import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import {
  captureSignal,
  generateCaption,
  generatePostImage,
  publishPostToBackend,
  savePostToBackend,
} from '../src/services/api';
import { SchedulePicker } from '../src/components/SchedulePicker';
import { Platform as SocialPlatform, TEMPLATES_BY_TYPE, StudioStyle } from '../src/types';

const CARD = '#141414';

const STUDIO_STYLES: { id: StudioStyle; label: string }[] = [
  { id: 'clean-white', label: 'Clean White' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'dark-dramatic', label: 'Dark Dramatic' },
  { id: 'flat-lay', label: 'Flat Lay' },
  { id: 'outdoor-natural', label: 'Outdoor Natural' },
];

function imageDataUri(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s.startsWith('data:') || s.startsWith('http')) return s;
  return `data:image/jpeg;base64,${s}`;
}

const TEMPLATE_PREVIEWS: Record<string, string[]> = {
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=320&h=380&fit=crop',
  ],
  salon: [
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=320&h=380&fit=crop',
  ],
  retail: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=320&h=380&fit=crop',
  ],
  gym: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=320&h=380&fit=crop',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=320&h=380&fit=crop',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=320&h=380&fit=crop',
  ],
};

export default function TemplateWorkflowScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const socialAccounts = useAppStore((s) => s.socialAccounts);
  const checkEntitlement = useAppStore((s) => s.checkEntitlement);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setPaywallSuccessCallback = useAppStore((s) => s.setPaywallSuccessCallback);
  const showToast = useAppStore((s) => s.showToast);
  const addPost = useAppStore((s) => s.addPost);
  const updatePost = useAppStore((s) => s.updatePost);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);

  const templates = TEMPLATES_BY_TYPE[businessProfile.type] || TEMPLATES_BY_TYPE.restaurant;
  const selectedTemplateId = String(templateId || templates.find((t) => t.id !== 'auto')?.id || 'auto');
  const template = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const templatePreview = useMemo(() => {
    const list = TEMPLATE_PREVIEWS[businessProfile.type] || TEMPLATE_PREVIEWS.restaurant;
    const idx = Math.max(0, templates.findIndex((t) => t.id === selectedTemplateId));
    return list[idx % list.length];
  }, [businessProfile.type, selectedTemplateId, templates]);

  const [photo, setPhoto] = useState<string | null>(null);
  const [studioStylePreference, setStudioStylePreference] = useState<StudioStyle | null>(null);
  const [studioVariants, setStudioVariants] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [caption, setCaption] = useState('');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    instagram: !!socialAccounts.instagram?.connected,
    facebook: !!socialAccounts.facebook?.connected,
  });

  const enabledCount = Object.values(platforms).filter(Boolean).length;

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to pick photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
  };

  const runSaveDraft = async (opts?: { overrideCaption?: string; overrideImage?: string | null }) => {
    const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
    const saved = await savePostToBackend({
      id: draftId || undefined,
      template: selectedTemplateId,
      photo: photo || undefined,
      description: description.trim(),
      caption: opts?.overrideCaption ?? caption,
      processedImage: opts?.overrideImage ?? processedImage ?? undefined,
      platforms: enabledPlatforms,
      status: 'draft',
    });
    if (draftId) updatePost(draftId, saved);
    else addPost(saved);
    setDraftId(saved.id);
    return saved;
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      showToast('Add a short description first', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const genBiz = {
        businessName: businessProfile.name,
        businessType: businessProfile.type,
        brandStyle: businessProfile.brandStyle,
        displayType: businessProfile.displayType,
        aiCategory: businessProfile.type,
        customDescription: businessProfile.customDescription || '',
        brandColor: businessProfile.brandColor,
        brandVibe: businessProfile.brandVibe,
        dominantColors: businessProfile.dominantColors,
        websiteSummary: businessProfile.websiteSummary,
        city: businessProfile.city,
        instagramHandle: businessProfile.instagramHandle,
        toneOfVoice: businessProfile.toneOfVoice,
        contentPersona: businessProfile.contentPersona,
        uniqueDifferentiator: businessProfile.uniqueDifferentiator,
        visualStyle: businessProfile.visualStyle,
        studioBgColor: businessProfile.studioBgColor,
      };
      const studioStyleForGen = photo ? studioStylePreference ?? undefined : undefined;
      const [cap, img] = await Promise.all([
        generateCaption({
          description: description.trim(),
          template: selectedTemplateId,
          studioStylePreference: studioStyleForGen,
          ...genBiz,
        }),
        generatePostImage({
          photo: photo || undefined,
          template: selectedTemplateId,
          description: description.trim(),
          studioStylePreference: studioStyleForGen,
          ...genBiz,
        }),
      ]);
      const variants = img?.variants ?? [];
      setStudioVariants(variants);
      const pick = img?.withOverlay ?? img?.clean ?? null;
      const studioPick =
        !pick && variants.length > 0 ? variants[0] : null;
      const chosenImage = pick ?? studioPick ?? templatePreview;
      if (!img?.withOverlay && !img?.clean && !variants.length) {
        showToast('AI image enhancement failed. Using template preview.', 'info');
      }
      setCaption(cap);
      setProcessedImage(chosenImage);
      const saved = await runSaveDraft({ overrideCaption: cap, overrideImage: chosenImage });
      void captureSignal({
        signalType: 'regenerate',
        topic: description.trim(),
        metadata: { postId: saved.id, workflow: 'template', reason: 'template_preview_generate' },
      }).catch(() => {});
      showToast('Preview generated', 'success');
    } catch {
      showToast('Could not generate preview', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePostNow = async () => {
    if (!draftId) {
      showToast('Generate first', 'error');
      return;
    }
    if (!checkEntitlement()) {
      setPaywallSuccessCallback(() => handlePostNow());
      setShowPaywall(true);
      return;
    }
    setIsPosting(true);
    try {
      await runSaveDraft();
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]);
      const result = await publishPostToBackend(draftId, enabledPlatforms);
      if (result.success) {
        updatePost(draftId, { status: 'published', publishedAt: new Date().toISOString() });
        void captureSignal({
          signalType: 'publish',
          topic: description.trim() || undefined,
          studioStyle: studioStylePreference ?? undefined,
          metadata: {
            postId: draftId,
            platforms: enabledPlatforms,
            workflow: 'template',
          },
        }).catch(() => {});
        showToast('Posted successfully', 'success');
      } else {
        showToast(result.message || 'Could not post', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not post', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = async (d: Date) => {
    setShowSchedulePicker(false);
    if (!checkEntitlement()) {
      setShowPaywall(true);
      return;
    }
    try {
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
      const post = await savePostToBackend({
        id: draftId || undefined,
        template: selectedTemplateId,
        photo: photo || undefined,
        description: description.trim(),
        caption,
        processedImage: processedImage || undefined,
        platforms: enabledPlatforms,
        status: 'scheduled',
        scheduledAt: d.toISOString(),
      });
      if (draftId) updatePost(draftId, post);
      else addPost(post);
      setDraftId(post.id);
      showToast('Scheduled successfully', 'success');
    } catch {
      showToast('Could not schedule', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{template.label}</Text>
        </View>

        <View style={styles.card}>
          <Image source={{ uri: templatePreview }} style={styles.templatePreview} />
          <Text style={styles.inputLabel}>Add your photo (optional)</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity onPress={pickPhoto} style={styles.uploadBtn}>
              <Ionicons name="image-outline" size={16} color={Colors.primary} />
              <Text style={styles.uploadText}>{photo ? 'Change Photo' : 'Upload Photo (optional)'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.photoRow}>
            <TouchableOpacity onPress={takePhoto} style={styles.uploadBtn}>
              <Ionicons name="camera-outline" size={16} color={Colors.primary} />
              <Text style={styles.uploadText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
          {!!photo && <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoPreview} />}
          {!!photo && (
            <View style={styles.studioBlock}>
              <Text style={styles.studioStyleLabel}>AI Photo Studio style</Text>
              <View style={styles.studioStyleRow}>
                {STUDIO_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      const next = studioStylePreference === s.id ? null : s.id;
                      setStudioStylePreference(next);
                      if (next) {
                        void captureSignal({
                          signalType: 'studio_style_selected',
                          studioStyle: next,
                          topic: description.trim() || undefined,
                          metadata: { context: 'template' },
                        }).catch(() => {});
                      }
                    }}
                    style={[
                      styles.studioStyleChip,
                      studioStylePreference === s.id && styles.studioStyleChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioStyleChipText,
                        studioStylePreference === s.id && styles.studioStyleChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <Text style={styles.inputLabel}>What is this post about? *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Write a short description..."
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
            multiline
          />
          <Text style={styles.tipText}>
            Tip: You can generate a full post with AI even without uploading a photo.
          </Text>

          <TouchableOpacity onPress={handleGenerate} style={styles.generateBtn} disabled={isGenerating}>
            {isGenerating ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.generateText}>Generate Preview</Text>}
          </TouchableOpacity>
        </View>

        {!!caption && (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Generated Preview</Text>
            {studioVariants.length > 1 && (
              <View style={styles.photoVariantRow}>
                {studioVariants.map((variant, idx) => (
                  <TouchableOpacity
                    key={`studio-variant-${idx}`}
                    activeOpacity={0.85}
                    onPress={() => {
                      setProcessedImage(variant);
                      void captureSignal({
                        signalType: 'variant_selected',
                        topic: description.trim() || undefined,
                        metadata: { variantIndex: idx + 1, postId: draftId ?? undefined },
                      }).catch(() => {});
                    }}
                    style={[
                      styles.photoVariantThumb,
                      processedImage === variant && styles.photoVariantThumbSelected,
                    ]}
                  >
                    <Image
                      source={{ uri: imageDataUri(variant) ?? '' }}
                      style={styles.photoVariantImg}
                      resizeMode="cover"
                    />
                    <Text style={styles.photoVariantLabel}>Variant {idx + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!!processedImage && (
              <Image
                source={{ uri: imageDataUri(processedImage) || processedImage }}
                style={styles.generatedImage}
                resizeMode="cover"
              />
            )}
            <Text style={styles.caption}>{caption}</Text>

            <View style={styles.platformRow}>
              {(['instagram', 'facebook'] as SocialPlatform[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPlatforms((v) => ({ ...v, [p]: !v[p] }))}
                  style={[styles.platformChip, platforms[p] && styles.platformChipActive]}
                >
                  <Text style={styles.platformChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handlePostNow} style={styles.primaryBtn} disabled={isPosting || enabledCount === 0}>
              {isPosting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Confirm & Post ({enabledCount})</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSchedulePicker(true)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Confirm & Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const saved = await runSaveDraft();
                void captureSignal({
                  signalType: 'save_without_publish',
                  topic: description.trim() || undefined,
                  studioStyle: studioStylePreference ?? undefined,
                  metadata: { postId: saved.id, workflow: 'template' },
                }).catch(() => {});
                setCurrentEdit(saved);
                router.push('/(tabs)/create');
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Continue in Create</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <SchedulePicker
        visible={showSchedulePicker}
        onCancel={() => setShowSchedulePicker(false)}
        onConfirm={handleSchedule}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { paddingBottom: 120, paddingHorizontal: Spacing.base },
  header: { paddingTop: Spacing.base, paddingBottom: Spacing.md, gap: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: Colors.primary, fontWeight: '700' },
  title: { ...Typography.h3, color: Colors.textPrimary },
  card: {
    backgroundColor: CARD,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  templatePreview: { width: '100%', height: 220, borderRadius: BorderRadius.md, marginBottom: 12 },
  inputLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: BorderRadius.md,
    minHeight: 90,
    color: Colors.white,
    padding: 12,
    marginBottom: 12,
  },
  tipText: { fontSize: 12, color: Colors.textTertiary, marginTop: -2, marginBottom: 12 },
  photoRow: { marginBottom: 10 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  uploadText: { color: Colors.primary, fontWeight: '700' },
  photoPreview: { width: '100%', height: 180, borderRadius: BorderRadius.md, marginBottom: 10 },
  studioBlock: { marginBottom: 12 },
  studioStyleLabel: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  studioStyleRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studioStyleChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#101522',
  },
  studioStyleChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  studioStyleChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  studioStyleChipTextActive: { color: Colors.primary },
  photoVariantRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  photoVariantThumb: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: CARD,
  },
  photoVariantThumbSelected: {
    borderColor: Colors.primary,
  },
  photoVariantImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#222',
  },
  photoVariantLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingVertical: 6,
  },
  generateBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: 12, alignItems: 'center' },
  generateText: { color: Colors.white, fontWeight: '800' },
  generatedImage: { width: '100%', height: 220, borderRadius: BorderRadius.md, marginBottom: 10 },
  caption: { color: Colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  platformRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  platformChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  platformChipText: { color: Colors.textSecondary, textTransform: 'capitalize' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  primaryBtnText: { color: Colors.white, fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#121212', borderRadius: BorderRadius.full, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: '700' },
});
