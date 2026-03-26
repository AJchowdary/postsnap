import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Modal,
  Alert, Dimensions, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import { Post, PostStatus } from '../../src/types';
import { deletePostFromBackend, fetchPostsFromBackend } from '../../src/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

type Filter = 'all' | 'instagram' | 'facebook';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: Colors.instagram,
  facebook: Colors.facebook,
};

const STATUS_CONFIG: Record<PostStatus, { bg: string; text: string; icon: string }> = {
  published: { bg: Colors.successLight, text: '#15803d', icon: 'checkmark-circle' },
  draft: { bg: Colors.warningLight, text: '#b45309', icon: 'document-text' },
  failed: { bg: Colors.errorLight, text: Colors.error, icon: 'close-circle' },
  scheduled: { bg: 'rgba(99,102,241,0.15)', text: '#6366f1', icon: 'calendar-outline' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return 'Just now';
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatScheduled(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function imageDataUri(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s.startsWith('data:') || s.startsWith('http')) return s;
  return `data:image/jpeg;base64,${s}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const posts = useAppStore((s) => s.posts);
  const deletePost = useAppStore((s) => s.deletePost);
  const setPosts = useAppStore((s) => s.setPosts);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);
  const showToast = useAppStore((s) => s.showToast);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);

  // Reload posts from backend every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPostsFromBackend()
        .then((backendPosts) => setPosts(backendPosts)) // always sync (handles empty list too)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [setPosts])
  );

  const q = query.trim().toLowerCase();
  const filtered = posts.filter((p) => {
    const matchesPlatform = filter === 'all' ? true : p.platforms.includes(filter);
    const text = `${p.caption} ${p.description || ''}`.toLowerCase();
    const matchesQuery = q ? text.includes(q) : true;
    return matchesPlatform && matchesQuery;
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sixDaysAgo = new Date(startOfToday);
  sixDaysAgo.setDate(startOfToday.getDate() - 6);

  const groups = {
    today: filtered.filter((p) => new Date(p.createdAt) >= startOfToday),
    thisWeek: filtered.filter((p) => {
      const d = new Date(p.createdAt);
      return d < startOfToday && d >= sixDaysAgo;
    }),
    older: filtered.filter((p) => new Date(p.createdAt) < sixDaysAgo),
  };

  const handleDelete = useCallback((post: Post) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostFromBackend(post.id);
            deletePost(post.id);
            setSelectedPost(null);
            showToast('Post deleted', 'info');
          } catch (err: any) {
            showToast(err?.message || 'Could not delete post', 'error');
          }
        },
      },
    ]);
  }, [deletePost, showToast]);

  const handleRepost = (post: Post) => {
    setCurrentEdit({ template: post.template, photo: post.photo, description: post.description });
    setSelectedPost(null);
    router.push('/(tabs)/create');
  };

  const handleDuplicate = (post: Post) => {
    setCurrentEdit({ ...post, id: undefined, status: 'draft' });
    setSelectedPost(null);
    router.push('/(tabs)/create');
  };

  const handleContinueEditing = (post: Post) => {
    setCurrentEdit(post);
    setSelectedPost(null);
    router.push('/(tabs)/create');
  };

  const emptyMessage = q ? 'No matching posts found' : 'No posts yet';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} testID="history-title">History</Text>
          {loading && <ActivityIndicator size="small" color={Colors.primary} style={styles.headerSpinner} />}
        </View>
        <Text style={styles.count}>{filtered.length} post{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Filter */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
        <TextInput
          testID="history-search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search posts..."
          placeholderTextColor={Colors.textTertiary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            testID={`history-filter-${f.id}`}
            onPress={() => setFilter(f.id)}
            activeOpacity={0.8}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grouped List */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>{emptyMessage}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/create')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Create your first post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[
            { key: 'Today', data: groups.today },
            { key: 'This Week', data: groups.thisWeek },
            { key: 'Older', data: groups.older },
          ]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: section }) => {
            if (section.data.length === 0) return null;
            return (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>{section.key}</Text>
                {section.data.map((post) => {
                  const sc = STATUS_CONFIG[post.status];
                  const primaryPlatform = post.platforms[0] || 'instagram';
                  const platformColor = PLATFORM_COLORS[primaryPlatform] || Colors.instagram;
                  const captionText = (post.caption || '').trim()
                    || (post.status === 'published' ? 'Published post' : 'Draft post');
                  return (
                    <TouchableOpacity
                      key={post.id}
                      testID={`history-post-${post.id}`}
                      onPress={() => setSelectedPost(post)}
                      activeOpacity={0.82}
                      style={styles.card}
                    >
                      <View style={styles.cardThumb}>
                        {post.processedImage || post.photo ? (
                          <Image
                            source={{ uri: imageDataUri(post.processedImage || post.photo) }}
                            style={styles.cardThumbImg}
                          />
                        ) : (
                          <View style={styles.thumbPlaceholder}>
                            <Text style={styles.templateEmoji}>
                              {getTemplateEmoji(post.template)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTopMeta}>
                          <View style={[styles.platformLabel, { backgroundColor: platformColor }]}>
                            <Text style={styles.platformLabelText}>
                              {primaryPlatform === 'instagram' ? 'Instagram' : 'Facebook'}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                            <Ionicons name={sc.icon as any} size={10} color={sc.text} />
                            <Text style={[styles.statusText, { color: sc.text }]}>{post.status}</Text>
                          </View>
                        </View>
                        <Text style={styles.cardCaption} numberOfLines={2}>{captionText}</Text>
                        <Text style={styles.dateText}>
                          {post.status === 'scheduled' && post.scheduledAt
                            ? formatScheduled(post.scheduledAt)
                            : formatDate(post.createdAt)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          }}
        />
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onRepost={() => handleRepost(selectedPost)}
          onDuplicate={() => handleDuplicate(selectedPost)}
          onContinueEditing={() => handleContinueEditing(selectedPost)}
          onDelete={() => handleDelete(selectedPost)}
        />
      )}
    </SafeAreaView>
  );
}

function PostDetailModal({
  post, onClose, onRepost, onDuplicate, onContinueEditing, onDelete,
}: {
  post: Post;
  onClose: () => void;
  onRepost: () => void;
  onDuplicate: () => void;
  onContinueEditing: () => void;
  onDelete: () => void;
}) {
  const sc = STATUS_CONFIG[post.status];
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <TouchableOpacity style={modal.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={modal.sheet}>
          {/* Handle */}
          <View style={modal.handle} />
          <View style={modal.sheetHeader}>
            <Text style={modal.sheetTitle}>{getTemplateLabel(post.template)}</Text>
            <TouchableOpacity testID="post-detail-close-btn" onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Image */}
            {(post.processedImage || post.photo) ? (
              <Image
                source={{ uri: imageDataUri(post.processedImage || post.photo) }}
                style={modal.image}
                resizeMode="cover"
              />
            ) : (
              <View style={modal.imagePlaceholder}>
                <Text style={modal.templateEmojiLg}>{getTemplateEmoji(post.template)}</Text>
              </View>
            )}

            <View style={modal.body}>
              {/* Status & Platforms */}
              <View style={modal.metaRow}>
                <View style={[modal.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[modal.statusText, { color: sc.text }]}>{post.status}</Text>
                </View>
                {post.platforms.map((p) => (
                  <View key={p} style={[modal.platformTag, { backgroundColor: PLATFORM_COLORS[p] }]}>
                    <Ionicons name={p === 'instagram' ? 'logo-instagram' : 'logo-facebook'} size={12} color={Colors.white} />
                    <Text style={modal.platformText}>{p}</Text>
                  </View>
                ))}
                <Text style={modal.dateText}>{formatDate(post.createdAt)}</Text>
              </View>

              {/* Caption */}
              <View style={modal.captionBox}>
                <Text style={modal.captionLabel}>Caption</Text>
                <Text style={modal.captionText}>
                  {(post.caption || '').trim() || (post.status === 'published' ? 'Published post' : 'Draft post')}
                </Text>
              </View>

              {/* Actions */}
              <View style={modal.actions}>
                {post.status === 'draft' ? (
                  <ActionBtn
                    icon="pencil"
                    label="Continue Editing"
                    color={Colors.primary}
                    testID="post-detail-continue-btn"
                    onPress={onContinueEditing}
                  />
                ) : (
                  <ActionBtn icon="refresh" label="Repost" color={Colors.primary} testID="post-detail-repost-btn" onPress={onRepost} />
                )}
                <ActionBtn icon="copy" label="Duplicate" color={Colors.textSecondary} testID="post-detail-duplicate-btn" onPress={onDuplicate} />
                <ActionBtn icon="trash" label="Delete" color={Colors.error} testID="post-detail-delete-btn" onPress={onDelete} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionBtn({ icon, label, color, onPress, testID }: {
  icon: string; label: string; color: string; onPress: () => void; testID?: string;
}) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.75} style={modal.actionBtn}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[modal.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getTemplateEmoji(template: string): string {
  const map: Record<string, string> = {
    'today-special': '🍽️', 'new-item': '🆕', 'behind-scenes': '📸',
    'before-after': '✨', 'promo': '🎉', 'new-look': '💅',
    'new-arrival': '🛍️', 'sale': '💸', 'transformation': '💪',
    'new-class': '🏋️', auto: '✨',
  };
  return map[template] || '📱';
}

function getTemplateLabel(template: string): string {
  const map: Record<string, string> = {
    'today-special': "Today's Special", 'new-item': 'New Item', 'behind-scenes': 'Behind the Scenes',
    'before-after': 'Before & After', promo: 'Promo', 'new-look': 'New Look',
    'new-arrival': 'New Arrival', sale: 'Sale', transformation: 'Transformation',
    'new-class': 'New Class', auto: 'Auto',
  };
  return map[template] || template;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...Typography.h2 },
  headerSpinner: { marginLeft: 4 },
  count: { ...Typography.bodySmall, color: Colors.textTertiary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.base },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainerHigh },
  filterChipActive: { backgroundColor: Colors.primaryLight },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { ...Typography.bodyLarge, color: Colors.textSecondary, fontWeight: '600' },
  emptyBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full, marginTop: 4 },
  emptyBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 110 },
  group: { marginBottom: Spacing.lg },
  groupTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainer, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, ...Shadows.sm },
  cardThumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden' },
  cardThumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.subtle, alignItems: 'center', justifyContent: 'center' },
  templateEmoji: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTopMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  platformLabel: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  platformLabelText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  cardCaption: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4, lineHeight: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 11, color: Colors.textTertiary },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: Colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', paddingBottom: 32 },
  handle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle: { ...Typography.h4 },
  image: { width: '100%', height: SCREEN_W * 0.75, backgroundColor: Colors.subtle },
  imagePlaceholder: { width: '100%', height: 200, backgroundColor: Colors.subtle, alignItems: 'center', justifyContent: 'center' },
  templateEmojiLg: { fontSize: 56 },
  body: { padding: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  platformTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  platformText: { color: Colors.white, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' },
  captionBox: { backgroundColor: Colors.subtle, borderRadius: BorderRadius.lg, padding: 14, marginBottom: 20 },
  captionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  captionText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.subtle, borderRadius: BorderRadius.lg, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  actionLabel: { fontSize: 12, fontWeight: '600' },
});
