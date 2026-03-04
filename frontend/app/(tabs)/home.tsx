import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import StatusChip from '../../src/components/StatusChip';
import { POST_IDEAS } from '../../src/types';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return 'Just now';
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const subscription = useAppStore((s) => s.subscription);
  const posts = useAppStore((s) => s.posts);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);

  const recentPosts = posts.slice(0, 3);
  const latestDraft = posts.find((p) => p.status === 'draft');
  const ideas = POST_IDEAS[businessProfile.type] || POST_IDEAS.restaurant;

  const handleContinueDraft = () => {
    if (latestDraft) {
      setCurrentEdit(latestDraft);
      router.push('/(tabs)/create');
    }
  };

  const handleIdeaTap = (idea: { template: string; description: string }) => {
    setCurrentEdit({ template: idea.template, description: idea.description });
    router.push('/(tabs)/create');
  };

  const platformColors: Record<string, string> = {
    instagram: Colors.instagram,
    facebook: Colors.facebook,
  };
  const statusColors: Record<string, { bg: string; text: string }> = {
    published: { bg: Colors.successLight, text: '#15803d' },
    draft: { bg: Colors.warningLight, text: '#b45309' },
    failed: { bg: Colors.errorLight, text: Colors.error },
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>PS</Text>
            </View>
            <View>
              <Text style={styles.businessName}>{businessProfile.name}</Text>
              <Text style={styles.businessType} testID="home-business-type">
                {businessProfile.type.charAt(0).toUpperCase() + businessProfile.type.slice(1)}
                {businessProfile.city ? ` · ${businessProfile.city}` : ''}
              </Text>
            </View>
          </View>
          <StatusChip
            status={subscription.status}
            daysLeft={subscription.daysLeft}
            testID="home-status-chip"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              testID="home-create-post-btn"
              onPress={() => { setCurrentEdit(null); router.push('/(tabs)/create'); }}
              activeOpacity={0.85}
              style={styles.primaryAction}
            >
              <View style={styles.primaryActionIcon}>
                <Ionicons name="add" size={28} color={Colors.white} />
              </View>
              <Text style={styles.primaryActionText}>Create Post</Text>
              <Text style={styles.primaryActionSub}>Takes ~30 seconds</Text>
            </TouchableOpacity>

            <View style={styles.secondaryActionsCol}>
              <TouchableOpacity
                testID="home-use-last-template-btn"
                onPress={() => {
                  const last = posts.find((p) => p.status === 'published');
                  if (last) setCurrentEdit({ template: last.template, description: '' });
                  router.push('/(tabs)/create');
                }}
                activeOpacity={0.8}
                style={[styles.secondaryAction, styles.secondaryTop]}
              >
                <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>Last Template</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="home-continue-draft-btn"
                onPress={handleContinueDraft}
                disabled={!latestDraft}
                activeOpacity={0.8}
                style={[styles.secondaryAction, !latestDraft && styles.secondaryDisabled]}
              >
                <Ionicons name="document-text-outline" size={18} color={latestDraft ? Colors.secondary : Colors.textTertiary} />
                <Text style={[styles.secondaryActionText, !latestDraft && { color: Colors.textTertiary }]}>
                  {latestDraft ? 'Continue Draft' : 'No Drafts'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Post Ideas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Post Ideas</Text>
          <View style={styles.ideasRow}>
            {ideas.map((idea, i) => (
              <TouchableOpacity
                key={i}
                testID={`home-post-idea-${i}`}
                onPress={() => handleIdeaTap(idea)}
                activeOpacity={0.8}
                style={styles.ideaCard}
              >
                <Text style={styles.ideaEmoji}>{idea.emoji}</Text>
                <Text style={styles.ideaTitle}>{idea.title}</Text>
                <Text style={styles.ideaSub} numberOfLines={2}>{idea.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentPosts.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="images-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No posts yet — create your first one!</Text>
            </View>
          ) : (
            recentPosts.map((post) => {
              const sc = statusColors[post.status] || statusColors.draft;
              return (
                <TouchableOpacity
                  key={post.id}
                  testID={`home-recent-post-${post.id}`}
                  onPress={() => router.push('/(tabs)/history')}
                  activeOpacity={0.8}
                  style={styles.recentItem}
                >
                  <View style={[styles.recentThumb, { backgroundColor: Colors.subtle }]}>
                    {post.processedImage || post.photo ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${post.processedImage || post.photo}` }}
                        style={styles.thumbImg}
                      />
                    ) : (
                      <Ionicons name="image-outline" size={20} color={Colors.textTertiary} />
                    )}
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentCaption} numberOfLines={2}>{post.caption}</Text>
                    <View style={styles.recentMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{post.status}</Text>
                      </View>
                      <View style={styles.platformBadges}>
                        {post.platforms.map((p) => (
                          <View key={p} style={[styles.platformDot, { backgroundColor: platformColors[p] }]} />
                        ))}
                      </View>
                      <Text style={styles.recentDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: Colors.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  businessName: { ...Typography.h4, fontWeight: '700' },
  businessType: { ...Typography.bodySmall, color: Colors.textTertiary, marginTop: 1 },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', gap: Spacing.md },
  primaryAction: {
    flex: 1.4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.primary,
  },
  primaryActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryActionText: { color: Colors.white, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  primaryActionSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  secondaryActionsCol: { flex: 1, gap: Spacing.md },
  secondaryAction: {
    flex: 1,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  secondaryTop: { borderColor: Colors.primaryLight, backgroundColor: Colors.primaryLight },
  secondaryDisabled: { opacity: 0.5 },
  secondaryActionText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  ideasRow: { flexDirection: 'row', gap: Spacing.md },
  ideaCard: {
    flex: 1,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  ideaEmoji: { fontSize: 22, marginBottom: 6 },
  ideaTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  ideaSub: { fontSize: 11, color: Colors.textTertiary, lineHeight: 15 },
  emptyActivity: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { ...Typography.bodySmall, color: Colors.textTertiary, textAlign: 'center' },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  recentThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  recentInfo: { flex: 1 },
  recentCaption: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, marginBottom: 6, lineHeight: 18 },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  platformBadges: { flexDirection: 'row', gap: 4 },
  platformDot: { width: 8, height: 8, borderRadius: 4 },
  recentDate: { fontSize: 11, color: Colors.textTertiary },
});
