import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../src/constants/theme';
import PrimaryButton from '../../../src/components/PrimaryButton';
import { fetchCampaigns, type CampaignSummary } from '../../../src/services/api';
import { useAppStore } from '../../../src/store/appStore';

export default function CampaignsListScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [items, setItems] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchCampaigns();
      setItems(data);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not load campaigns', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.sub}>Briefs for repeatable creatives</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <Text style={styles.emptySub}>Create a brief and generate posts from it.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(tabs)/campaigns/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.thumbWrap}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={Colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.creativeCount} creative{item.creativeCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.footer}>
        <PrimaryButton title="New campaign" onPress={() => router.push('/(tabs)/campaigns/new' as any)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  title: { ...Typography.h2, color: Colors.textPrimary },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl * 2 },
  emptyTitle: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.md },
  emptySub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  thumbWrap: { marginRight: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: BorderRadius.md },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { ...Typography.h4, color: Colors.textPrimary },
  cardMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg + 68,
  },
});
