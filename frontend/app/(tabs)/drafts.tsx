import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import type { Post } from '../../src/types';
import {
  DRAFT_LIMIT,
  deletePostFromBackend,
  fetchDraftsFromBackend,
} from '../../src/services/api';

function listImageUri(post: Post): string | undefined {
  const raw =
    post.processedImageUrl ||
    post.photoUrl ||
    post.processedImage ||
    post.photo;
  if (!raw) return undefined;
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DraftsScreen() {
  const router = useRouter();
  const deletePost = useAppStore((s) => s.deletePost);
  const showToast = useAppStore((s) => s.showToast);

  const [drafts, setDrafts] = useState<Post[]>([]);
  const [limit, setLimit] = useState(DRAFT_LIMIT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { posts, limit: lim } = await fetchDraftsFromBackend();
      setDrafts(posts);
      setLimit(lim);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openDraft = (post: Post) => {
    router.push({ pathname: '/post-preview', params: { postId: post.id } } as any);
  };

  const confirmDelete = (post: Post) => {
    Alert.alert('Delete draft', 'Remove this draft permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostFromBackend(post.id);
            deletePost(post.id);
            setDrafts((prev) => prev.filter((p) => p.id !== post.id));
            showToast('Draft deleted', 'info');
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Could not delete', 'error');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/settings');
          }}
          hitSlop={12}
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Drafts</Text>
          <Text style={styles.sub}>
            {drafts.length} of {limit} slots
          </Text>
        </View>
        <View style={styles.backBtnSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No drafts</Text>
          <Text style={styles.emptySub}>Create a post — it saves as a draft until you publish.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/create')}>
            <Text style={styles.emptyBtnText}>Create post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const uri = listImageUri(item);
            const caption = (item.caption || '').trim() || 'Draft';
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => openDraft(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.thumb}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Ionicons name="image-outline" size={22} color={Colors.textTertiary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardCaption} numberOfLines={2}>
                      {caption}
                    </Text>
                    <Text style={styles.cardMeta}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.trash}
                  onPress={() => confirmDelete(item)}
                  hitSlop={10}
                  accessibilityLabel="Delete draft"
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, paddingTop: 2 },
  backBtnSpacer: { width: 40 },
  headerCenter: { flex: 1, minWidth: 0 },
  title: { ...Typography.h2 },
  sub: { ...Typography.bodySmall, color: Colors.textTertiary, marginTop: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: { ...Typography.h4, marginTop: Spacing.sm },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    minWidth: 0,
  },
  trash: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.subtle },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardCaption: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
});
