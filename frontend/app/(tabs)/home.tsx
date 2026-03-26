import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows, GradientColors } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return 'Just now';
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function imageDataUri(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s.startsWith('data:') || s.startsWith('http')) return s;
  return `data:image/jpeg;base64,${s}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const posts = useAppStore((s) => s.posts);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);
  const showToast = useAppStore((s) => s.showToast);

  const recentPosts = posts.slice(0, 3);
  const latestDraft = posts.find((p) => p.status === 'draft');
  const userName = businessProfile.name?.trim() || 'there';
  const userBusinessType = businessProfile.displayType?.trim() || 'your business';
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const postsThisWeek = posts.filter((p) => new Date(p.createdAt).getTime() >= oneWeekAgo).length;

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
            <View style={styles.logoRow}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
              <Text style={styles.logoText}>Quickpost</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            activeOpacity={0.85}
            onPress={() => showToast('Notifications coming soon', 'info')}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Hi {userName} 👋</Text>
          <Text style={styles.greetingSub}>Welcome back.</Text>
          <Text style={styles.greetingType}>Creating for {userBusinessType}</Text>
        </View>

        {/* Hero */}
        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(186,158,255,0.28)', 'rgba(105,156,255,0.20)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIllustration} />
            <Text style={styles.heroTitle}>What do you want to create today?</Text>
            <Text style={styles.heroMetric}>
              {postsThisWeek} post{postsThisWeek === 1 ? '' : 's'} created this week
            </Text>
            <TouchableOpacity
              testID="home-start-creating-btn"
              onPress={() => { setCurrentEdit(null); router.push('/(tabs)/create'); }}
              activeOpacity={0.9}
              style={styles.heroCtaWrap}
            >
              <LinearGradient colors={GradientColors.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Start Creating</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.background} />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              testID="home-action-post-btn"
              onPress={() => { setCurrentEdit(null); router.push('/(tabs)/create'); }}
              activeOpacity={0.85}
              style={styles.quickAction}
            >
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
              <Text style={styles.quickActionText}>Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="home-action-secondary-btn"
              onPress={() => {
                if (latestDraft) {
                  setCurrentEdit(latestDraft);
                  router.push('/(tabs)/create');
                } else {
                  router.push('/(tabs)/history');
                }
              }}
              activeOpacity={0.85}
              style={styles.quickAction}
            >
              <Ionicons
                name={latestDraft ? 'refresh-circle-outline' : 'time-outline'}
                size={20}
                color={Colors.secondary}
              />
              <Text style={styles.quickActionText}>{latestDraft ? 'Continue Draft' : 'History'}</Text>
            </TouchableOpacity>
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
              <TouchableOpacity
                testID="home-empty-create-btn"
                style={styles.emptyCta}
                activeOpacity={0.85}
                onPress={() => { setCurrentEdit(null); router.push('/(tabs)/create'); }}
              >
                <Text style={styles.emptyCtaText}>Create Post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentPosts.map((post) => {
              const sc = statusColors[post.status] || statusColors.draft;
              const captionText = (post.caption || '').trim()
                || (post.status === 'published' ? 'Published post' : 'Draft post');
              return (
                <TouchableOpacity
                  key={post.id}
                  testID={`home-recent-post-${post.id}`}
                  onPress={() => {
                    setCurrentEdit(post);
                    router.push('/(tabs)/create');
                  }}
                  activeOpacity={0.8}
                  style={styles.recentItem}
                >
                  <View style={[styles.recentThumb, { backgroundColor: Colors.subtle }]}>
                    {post.processedImage || post.photo ? (
                      <Image
                        source={{ uri: imageDataUri(post.processedImage || post.photo) }}
                        style={styles.thumbImg}
                      />
                    ) : (
                      <Ionicons name="image-outline" size={20} color={Colors.textTertiary} />
                    )}
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentCaption} numberOfLines={2}>{captionText}</Text>
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
  content: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  logoText: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  greetingWrap: { paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  greeting: { ...Typography.h2, marginBottom: 2 },
  greetingSub: { ...Typography.body, color: Colors.textSecondary },
  greetingType: { ...Typography.bodySmall, color: Colors.textTertiary, marginTop: 2 },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerHighest,
  },
  heroIllustration: {
    width: '100%',
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(186,158,255,0.20)',
    marginBottom: 12,
  },
  heroTitle: { ...Typography.h3, marginBottom: 14 },
  heroMetric: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: 12 },
  heroCtaWrap: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroCtaText: {
    color: Colors.background,
    fontWeight: '800',
    fontFamily: 'Manrope',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  quickActionText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Inter' },
  emptyActivity: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { ...Typography.bodySmall, color: Colors.textTertiary, textAlign: 'center' },
  emptyCta: {
    marginTop: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyCtaText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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
