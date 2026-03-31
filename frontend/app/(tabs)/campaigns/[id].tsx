import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../src/constants/theme';
import SecondaryButton from '../../../src/components/SecondaryButton';
import {
  deleteCampaign,
  fetchCampaign,
  fetchPostsFromBackend,
  generateCampaignCreative,
  publishPostToBackend,
  updateCampaign,
  type CampaignSummary,
} from '../../../src/services/api';
import type { Post, Platform as SocialPlatform } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = Spacing.lg;
const GRID_GAP = Spacing.sm;
const COL_W = (SCREEN_W - H_PAD * 2 - GRID_GAP) / 2;

function imageDataUri(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s.startsWith('data:') || s.startsWith('http')) return s;
  return `data:image/jpeg;base64,${s}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type GridEntry =
  | { kind: 'skeleton'; id: string }
  | { kind: 'post'; post: Post };

function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, { width: COL_W }]}>
      <Animated.View style={[styles.skeletonImg, { opacity: pulse }]} />
      <View style={styles.cardPad}>
        <Animated.View style={[styles.skeletonLine, { opacity: pulse, width: '90%' }]} />
        <Animated.View style={[styles.skeletonLine, { opacity: pulse, width: '60%', marginTop: 6 }]} />
        <View style={styles.chipRow}>
          <Animated.View style={[styles.skeletonChip, { opacity: pulse }]} />
          <Animated.View style={[styles.skeletonChip, { opacity: pulse }]} />
        </View>
        <View style={styles.cardActions}>
          <Animated.View style={[styles.skeletonBtn, { opacity: pulse }]} />
          <Animated.View style={[styles.skeletonBtn, { opacity: pulse }]} />
        </View>
      </View>
    </View>
  );
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const posts = useAppStore((s) => s.posts);
  const setPosts = useAppStore((s) => s.setPosts);
  const updatePost = useAppStore((s) => s.updatePost);
  const checkEntitlement = useAppStore((s) => s.checkEntitlement);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setPaywallSuccessCallback = useAppStore((s) => s.setPaywallSuccessCallback);

  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleDraft, setTitleDraft] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [pendingSkeletonIds, setPendingSkeletonIds] = useState<string[]>([]);
  const [regeneratingPostId, setRegeneratingPostId] = useState<string | null>(null);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [addingCreative, setAddingCreative] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  const loadCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const c = await fetchCampaign(id);
      setCampaign(c);
      setTitleDraft(c.title);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Campaign not found', 'error');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  const refreshPosts = useCallback(async () => {
    try {
      const list = await fetchPostsFromBackend();
      setPosts(list);
    } catch {
      /* ignore */
    }
  }, [setPosts]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCampaign();
      void refreshPosts();
    }, [loadCampaign, refreshPosts])
  );

  const campaignPosts = useMemo(() => {
    if (!id) return [];
    return posts
      .filter((p) => p.campaignId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts, id]);

  const gridData: GridEntry[] = useMemo(() => {
    const sk: GridEntry[] = pendingSkeletonIds.map((sid) => ({ kind: 'skeleton', id: sid }));
    const po: GridEntry[] = campaignPosts.map((post) => ({ kind: 'post', post }));
    return [...sk, ...po];
  }, [pendingSkeletonIds, campaignPosts]);

  const onTitleBlur = async () => {
    if (!id || !campaign) return;
    const next = titleDraft.trim();
    if (!next || next === campaign.title) return;
    try {
      const updated = await updateCampaign(id, { title: next });
      setCampaign(updated);
      showToast('Title updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not update title', 'error');
      setTitleDraft(campaign.title);
    }
  };

  const openMenu = () => {
    Alert.alert('Campaign', undefined, [
      { text: 'Edit title', onPress: () => titleInputRef.current?.focus() },
      { text: 'Delete campaign', style: 'destructive', onPress: () => onDelete() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Delete campaign', 'Creatives stay in History; this removes the brief only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCampaign(id);
            showToast('Campaign deleted', 'info');
            router.replace('/(tabs)/campaigns' as any);
          } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : 'Could not delete', 'error');
          }
        },
      },
    ]);
  };

  const runGenerate = async (opts?: { tempSkeletonId?: string; sourcePostId?: string }) => {
    if (!id) return;
    const tempId = opts?.tempSkeletonId;
    try {
      await generateCampaignCreative(id);
      await refreshPosts();
      if (tempId) {
        setPendingSkeletonIds((prev) => prev.filter((x) => x !== tempId));
      }
      await loadCampaign();
    } catch (e: unknown) {
      if (tempId) setPendingSkeletonIds((prev) => prev.filter((x) => x !== tempId));
      showToast(e instanceof Error ? e.message : 'Generation failed', 'error');
    } finally {
      if (opts?.sourcePostId) setRegeneratingPostId(null);
    }
  };

  const onAddCreative = async () => {
    if (!id || addingCreative) return;
    const tempId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingSkeletonIds((prev) => [...prev, tempId]);
    setAddingCreative(true);
    try {
      await runGenerate({ tempSkeletonId: tempId });
    } finally {
      setAddingCreative(false);
    }
  };

  const onRegenerate = async (post: Post) => {
    if (!id || regeneratingPostId) return;
    setRegeneratingPostId(post.id);
    await runGenerate({ sourcePostId: post.id });
  };

  const onPublish = async (post: Post) => {
    if (!checkEntitlement()) {
      setShowPaywall(true);
      setPaywallSuccessCallback(() => () => void onPublish(post));
      return;
    }
    const plats = (post.platforms?.length
      ? post.platforms
      : (['instagram', 'facebook'] as SocialPlatform[]));
    setPublishingPostId(post.id);
    try {
      const result = await publishPostToBackend(post.id, plats);
      if (result.success) {
        updatePost(post.id, { status: 'published', publishedAt: new Date().toISOString() });
        showToast('Posted successfully! 🎉', 'success');
        await refreshPosts();
      } else {
        showToast(result.message || 'Failed to post', 'error');
      }
    } catch (err: unknown) {
      const anyErr = err as { payload?: unknown };
      if (anyErr?.payload != null) {
        setPaywallSuccessCallback(() => {
          void onPublish(post);
        });
        setShowPaywall(true);
      } else {
        showToast(err instanceof Error ? err.message : 'Posting failed', 'error');
      }
    } finally {
      setPublishingPostId(null);
    }
  };

  const renderGridItem = ({ item }: { item: GridEntry }) => {
    if (item.kind === 'skeleton') {
      return <SkeletonCard />;
    }
    const post = item.post;
    const captionPreview = (post.caption || '').trim() || 'No caption yet';
    const busy = regeneratingPostId === post.id;
    const pubBusy = publishingPostId === post.id;
    const isGen = post.status === 'generating';

    return (
      <View style={[styles.card, { width: COL_W }]}>
        <View style={styles.thumbWrap}>
          {post.processedImage || post.photo ? (
            <Image
              source={{ uri: imageDataUri(post.processedImage || post.photo) }}
              style={styles.thumbImg}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="image-outline" size={28} color={Colors.textTertiary} />
            </View>
          )}
          {(busy || isGen) && (
            <View style={styles.thumbOverlay}>
              <ActivityIndicator color={Colors.white} />
            </View>
          )}
        </View>
        <View style={styles.cardPad}>
          <Text style={styles.captionPreview} numberOfLines={2}>
            {captionPreview}
          </Text>
          <View style={styles.chipRow}>
            {(post.platforms?.length ? post.platforms : (['instagram', 'facebook'] as const)).map((p) => (
              <View
                key={p}
                style={[
                  styles.platformChip,
                  { backgroundColor: p === 'instagram' ? Colors.instagram : Colors.facebook },
                ]}
              >
                <Text style={styles.platformChipText}>{p === 'instagram' ? 'IG' : 'FB'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => void onPublish(post)}
              disabled={pubBusy || busy || isGen}
              activeOpacity={0.85}
            >
              {pubBusy ? (
                <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.actionBtnTextPrimary}>Publish</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={() => void onRegenerate(post)}
              disabled={busy || pubBusy || isGen || addingCreative}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.actionBtnTextSecondary}>Regenerate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading || !campaign || !id) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarSpacer} />
        <TouchableOpacity onPress={openMenu} hitSlop={12} accessibilityLabel="Campaign menu">
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={gridData}
        keyExtractor={(entry) => (entry.kind === 'skeleton' ? entry.id : entry.post.id)}
        numColumns={2}
        columnWrapperStyle={gridData.length >= 2 ? styles.columnWrap : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TextInput
              ref={titleInputRef}
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={() => void onTitleBlur()}
              style={styles.titleInput}
              placeholder="Campaign title"
              placeholderTextColor={Colors.textTertiary}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPromptExpanded((e) => !e)}
              style={styles.promptToggle}
            >
              <Text style={styles.sectionLabel}>Brief</Text>
              <Ionicons
                name={promptExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {promptExpanded ? (
              <Text style={styles.body}>{campaign.prompt}</Text>
            ) : (
              <Text style={styles.promptCollapsed} numberOfLines={2}>
                {campaign.prompt}
              </Text>
            )}

            <Text style={styles.statusLine}>
              {campaignPosts.length} creative{campaignPosts.length === 1 ? '' : 's'} · Updated{' '}
              {formatShortDate(campaign.updatedAt)}
            </Text>

            <Text style={styles.creativesHeading}>
              Creatives ({campaignPosts.length + pendingSkeletonIds.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          pendingSkeletonIds.length === 0 ? (
            <Text style={styles.emptyCreatives}>No creatives yet — tap Add Creative below.</Text>
          ) : null
        }
        renderItem={renderGridItem}
        ListFooterComponent={
          <View style={styles.footerBlock}>
            <Text style={styles.aiDisclaimer}>
              AI can make mistakes. Review generated creatives before posting.
            </Text>
            <View style={styles.addCreativeWrap}>
              <SecondaryButton
                title="+ Add Creative"
                onPress={() => void onAddCreative()}
                loading={addingCreative}
                disabled={addingCreative || !!regeneratingPostId}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topBarSpacer: { flex: 1 },
  listContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: Spacing.xl + 80,
  },
  headerBlock: { marginBottom: Spacing.md },
  titleInput: {
    ...Typography.h3,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  promptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary },
  body: { ...Typography.body, color: Colors.textPrimary, marginBottom: Spacing.sm },
  promptCollapsed: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  statusLine: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  creativesHeading: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  columnWrap: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    justifyContent: 'space-between',
  },
  emptyCreatives: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPad: { padding: Spacing.sm },
  captionPreview: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textPrimary,
    minHeight: 32,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  platformChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  platformChipText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  actionPrimary: { backgroundColor: Colors.primary },
  actionSecondary: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnTextPrimary: { fontSize: 12, fontWeight: '800', color: Colors.textOnPrimary },
  actionBtnTextSecondary: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  skeletonImg: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  skeletonLine: { height: 10, backgroundColor: Colors.border, borderRadius: 4 },
  skeletonChip: { width: 36, height: 18, backgroundColor: Colors.border, borderRadius: 9 },
  skeletonBtn: { flex: 1, height: 32, backgroundColor: Colors.border, borderRadius: BorderRadius.md },
  footerBlock: { marginTop: Spacing.lg, gap: Spacing.md },
  addCreativeWrap: { width: '100%' },
  aiDisclaimer: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    opacity: 0.85,
    textAlign: 'center',
  },
});
