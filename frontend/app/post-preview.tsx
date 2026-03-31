import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, GradientColors, Shadows } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import {
  fetchPostById,
  savePostToBackend,
  publishPostToBackend,
  fetchDraftsFromBackend,
} from '../src/services/api';
import type { Platform as SocialPlatform, Post } from '../src/types';
import AiEditSheet from '../src/components/AiEditSheet';

function resolveImageUri(post: Post): string | null {
  if (post.processedImageUrl) return post.processedImageUrl;
  if (post.photoUrl) return post.photoUrl;
  const raw = post.processedImage || post.photo;
  if (!raw) return null;
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function extractHashtags(caption: string): string[] {
  const m = caption.match(/#[\w\u0080-\uFFFF]+/g) ?? [];
  const tags = m.map((t) => t.slice(1));
  return [...new Set(tags)];
}

function removeHashtagFromCaption(caption: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`#${escaped}(?=\\s|$)`, 'g');
  return caption.replace(re, '').replace(/\s{2,}/g, ' ').trim();
}

function PreviewSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [pulse]);
  return (
    <View style={skStyles.wrap}>
      <Animated.View style={[skStyles.hero, { opacity: pulse }]} />
      <Animated.View style={[skStyles.line, { opacity: pulse, width: '92%' }]} />
      <Animated.View style={[skStyles.line, { opacity: pulse, width: '78%' }]} />
      <Animated.View style={[skStyles.line, { opacity: pulse, width: '85%' }]} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
  },
  line: { height: 14, borderRadius: 6, backgroundColor: Colors.bgElevated },
});

export default function PostPreviewScreen() {
  const router = useRouter();
  const rawId = useLocalSearchParams<{ postId: string | string[] }>().postId;
  const postId = Array.isArray(rawId) ? rawId[0] : rawId;

  const businessProfile = useAppStore((s) => s.businessProfile);
  const showToast = useAppStore((s) => s.showToast);
  const updatePost = useAppStore((s) => s.updatePost);
  const checkEntitlement = useAppStore((s) => s.checkEntitlement);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setPaywallSuccessCallback = useAppStore((s) => s.setPaywallSuccessCallback);

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [caption, setCaption] = useState('');
  const [platformIg, setPlatformIg] = useState(true);
  const [platformFb, setPlatformFb] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addTagValue, setAddTagValue] = useState('');
  const [successOverlay, setSuccessOverlay] = useState(false);

  const hashtags = useMemo(() => extractHashtags(caption), [caption]);

  const selectedPlatforms = useMemo((): SocialPlatform[] => {
    const out: SocialPlatform[] = [];
    if (platformIg) out.push('instagram');
    if (platformFb) out.push('facebook');
    return out;
  }, [platformIg, platformFb]);

  const aiPostContext = useMemo(
    () => ({
      businessName: businessProfile.name || 'Your business',
      city: businessProfile.city || '',
      ideaText: post?.description ?? '',
      platform: selectedPlatforms as string[],
    }),
    [businessProfile.name, businessProfile.city, post?.description, selectedPlatforms]
  );

  const goBackSafe = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home' as any);
  }, [router]);

  const load = useCallback(async () => {
    if (!postId) {
      showToast('Missing post', 'error');
      goBackSafe();
      return;
    }
    setLoading(true);
    try {
      const p = await fetchPostById(postId);
      setPost(p);
      setCaption(p.caption || '');
      const plats = p.platforms?.length ? p.platforms : (['instagram', 'facebook'] as SocialPlatform[]);
      setPlatformIg(plats.includes('instagram'));
      setPlatformFb(plats.includes('facebook'));
    } catch {
      showToast('Could not load post', 'error');
      goBackSafe();
    } finally {
      setLoading(false);
    }
  }, [postId, showToast, goBackSafe]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleIg = () => {
    if (platformIg && !platformFb) {
      showToast('Keep at least one platform on.', 'info');
      return;
    }
    setPlatformIg((v) => !v);
  };
  const toggleFb = () => {
    if (platformFb && !platformIg) {
      showToast('Keep at least one platform on.', 'info');
      return;
    }
    setPlatformFb((v) => !v);
  };

  const imageUri = post ? resolveImageUri(post) : null;
  const brandColor = businessProfile.brandColor || Colors.primary;
  const brandSecond = businessProfile.brandColor ? Colors.primaryDark : Colors.primaryDark;

  const runPublish = async (targets: SocialPlatform[]) => {
    if (!post) return;
    if (!checkEntitlement()) {
      setPaywallSuccessCallback(() => {
        void runPublish(targets);
      });
      setShowPaywall(true);
      setPublishModalVisible(false);
      return;
    }
    const allowed = targets.filter((t) => (t === 'instagram' ? platformIg : platformFb));
    if (allowed.length === 0) {
      showToast('Turn on at least one platform above.', 'info');
      setPublishModalVisible(false);
      return;
    }
    setPublishModalVisible(false);
    setIsPublishing(true);
    try {
      const result = await publishPostToBackend(post.id, allowed);
      if (result.success) {
        updatePost(post.id, { status: 'published', publishedAt: new Date().toISOString() });
        setSuccessOverlay(true);
        showToast('Posted successfully!', 'success');
        setTimeout(() => {
          router.replace('/(tabs)/home' as any);
        }, 1500);
      } else {
        showToast(result.message || 'Post failed', 'error');
      }
    } catch (e: any) {
      if (e?.payload != null) {
        setPaywallSuccessCallback(() => {
          void runPublish(targets);
        });
        setShowPaywall(true);
      } else {
        showToast(e?.message || 'Post failed', 'error');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const openPublishMenu = () => {
    if (!post) return;
    if (!checkEntitlement()) {
      setPaywallSuccessCallback(() => setPublishModalVisible(true));
      setShowPaywall(true);
      return;
    }
    setPublishModalVisible(true);
  };

  const onSaveDraft = async () => {
    if (!post) return;
    setIsSaving(true);
    try {
      const { posts: drafts, count, limit } = await fetchDraftsFromBackend();
      const isThisDraft = drafts.some((d) => d.id === post.id);
      if (!isThisDraft && count >= limit) {
        Alert.alert(
          'Draft limit',
          `You have ${limit} saved drafts. Delete one before saving a new draft.`,
          [{ text: 'OK' }]
        );
        return;
      }
      await savePostToBackend({
        id: post.id,
        template: post.template,
        description: post.description,
        caption,
        photo: post.photo,
        processedImage: post.processedImage,
        platforms: selectedPlatforms,
        status: 'draft',
      });
      updatePost(post.id, { caption, platforms: selectedPlatforms, status: 'draft' });
      showToast('Saved to drafts', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const removeTag = (tag: string) => {
    setCaption((c) => removeHashtagFromCaption(c, tag));
  };

  const confirmAddTag = () => {
    const t = addTagValue.trim().replace(/^#+/, '');
    if (!t) {
      setAddTagOpen(false);
      return;
    }
    const withHash = caption.trim().length ? `${caption.trim()} #${t}` : `#${t}`;
    setCaption(withHash);
    setAddTagValue('');
    setAddTagOpen(false);
  };

  const onAiApplyChanges = (newCaption: string, newHashtags: string[]) => {
    const body = newCaption.trim();
    const tagStr = newHashtags.map((t) => `#${t.replace(/^#/, '')}`).join(' ');
    setCaption(tagStr ? `${body}\n\n${tagStr}` : body);
    setAiSheetVisible(false);
  };

  if (!postId) {
    return null;
  }

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PreviewSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafe} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <TouchableOpacity onPress={openPublishMenu} hitSlop={12}>
          <Text style={styles.headerPost}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.postImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[brandColor, brandSecond]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderGrad}
            >
              <Text style={styles.placeholderName} numberOfLines={2}>
                {businessProfile.name || 'Your business'}
              </Text>
            </LinearGradient>
          )}
        </View>

        <Text style={styles.sectionLabel}>Platforms</Text>
        <View style={styles.platformRow}>
          <TouchableOpacity
            style={[styles.platChip, platformIg && styles.platChipOn]}
            onPress={toggleIg}
          >
            <Text style={[styles.platChipText, platformIg && styles.platChipTextOn]}>Instagram</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.platChip, platformFb && styles.platChipOn]}
            onPress={toggleFb}
          >
            <Text style={[styles.platChipText, platformFb && styles.platChipTextOn]}>Facebook</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabelCap}>Caption</Text>
        <TextInput
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
          multiline
          placeholder="Write your caption..."
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.charCount}>{caption.length} characters</Text>

        <Text style={styles.sectionLabelHash}>Hashtags</Text>
        <View style={styles.hashWrap}>
          {hashtags.map((tag) => (
            <TouchableOpacity key={tag} style={styles.hashPill} onPress={() => removeTag(tag)}>
              <Text style={styles.hashPillText}>#{tag} ×</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addHashBtn} onPress={() => setAddTagOpen(true)}>
            <Text style={styles.addHashText}>+ Add hashtag</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.askAiBtn} onPress={() => setAiSheetVisible(true)} activeOpacity={0.9}>
          <Text style={styles.askAiEmoji}>✨</Text>
          <Text style={styles.askAiText}>Ask AI to edit this post</Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={onSaveDraft}
            disabled={isSaving}
          >
            <Ionicons name="bookmark-outline" size={18} color={Colors.primary} />
            <Text style={styles.draftBtnText}>{isSaving ? 'Saving…' : 'Save Draft'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postNowOuter} onPress={openPublishMenu} activeOpacity={0.9}>
            <LinearGradient colors={GradientColors.primary} style={styles.postNowGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.postNowText}>Post Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={publishModalVisible} transparent animationType="fade">
        <Pressable style={styles.pubOverlay} onPress={() => setPublishModalVisible(false)}>
          <View style={styles.pubCenter}>
            <Pressable style={styles.pubCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.pubTitle}>Post where?</Text>
          {platformIg ? (
            <TouchableOpacity
              style={styles.pubOption}
              onPress={() => void runPublish(['instagram'])}
            >
              <Text style={styles.pubOptionText}>Post to Instagram</Text>
            </TouchableOpacity>
          ) : null}
          {platformFb ? (
            <TouchableOpacity
              style={styles.pubOption}
              onPress={() => void runPublish(['facebook'])}
            >
              <Text style={styles.pubOptionText}>Post to Facebook</Text>
            </TouchableOpacity>
          ) : null}
          {platformIg && platformFb ? (
            <TouchableOpacity
              style={styles.pubOption}
              onPress={() => void runPublish(['instagram', 'facebook'])}
            >
              <Text style={styles.pubOptionText}>Post to both</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.pubCancel} onPress={() => setPublishModalVisible(false)}>
            <Text style={styles.pubCancelText}>Cancel</Text>
          </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={addTagOpen} transparent animationType="fade">
        <Pressable style={styles.pubOverlay} onPress={() => setAddTagOpen(false)}>
          <View style={styles.pubCenter}>
            <Pressable style={styles.tagCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.pubTitle}>Add hashtag</Text>
              <TextInput
                style={styles.tagInput}
                value={addTagValue}
                onChangeText={setAddTagValue}
                placeholder="summerlaunch"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.tagAddConfirm} onPress={confirmAddTag}>
                <Text style={styles.postNowText}>Add</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={isPublishing} transparent>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Posting...</Text>
        </View>
      </Modal>

      <Modal visible={successOverlay} transparent>
        <View style={styles.successOverlay}>
          <Text style={styles.successCheck}>✓</Text>
          <Text style={styles.successLabel}>Posted!</Text>
        </View>
      </Modal>

      <AiEditSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        currentCaption={caption}
        currentHashtags={hashtags}
        postContext={aiPostContext}
        onApplyChanges={onAiApplyChanges}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerPost: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  imageBox: { width: '100%', marginBottom: Spacing.md },
  postImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 12, backgroundColor: Colors.bgElevated },
  placeholderGrad: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  placeholderName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionLabelCap: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabelHash: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  platformRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  platChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platChipOn: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  platChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  platChipTextOn: { color: Colors.primaryDark },
  captionInput: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 6 },
  hashWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  hashPill: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hashPillText: { fontSize: 12, color: Colors.textPrimary },
  addHashBtn: { paddingVertical: 6 },
  addHashText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  askAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    height: 48,
  },
  askAiEmoji: { fontSize: 18 },
  askAiText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  draftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  draftBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  postNowOuter: { flex: 1, borderRadius: 24, overflow: 'hidden', ...Shadows.sm },
  postNowGrad: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postNowText: { fontSize: 15, fontWeight: '800', color: Colors.textOnPrimary },
  pubOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay40,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  pubCenter: {
    width: '100%',
  },
  pubCard: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    ...Shadows.card,
  },
  pubTitle: { ...Typography.h4, marginBottom: Spacing.md, textAlign: 'center' },
  pubOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pubOptionText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  pubCancel: { paddingVertical: 14 },
  pubCancelText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  tagCard: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    ...Shadows.card,
  },
  tagInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  tagAddConfirm: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: Spacing.md, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheck: { fontSize: 64, color: Colors.success, fontWeight: '800' },
  successLabel: { fontSize: 20, fontWeight: '800', color: Colors.white, marginTop: Spacing.sm },
});
