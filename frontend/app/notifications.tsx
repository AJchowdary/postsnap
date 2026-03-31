import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../src/constants/theme';
import {
  getNotifications,
  fetchPostById,
  markNotificationRead,
  markAllRead,
  type InAppNotification,
} from '../src/services/api';
import { useAppStore } from '../src/store/appStore';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);
  const showToast = useAppStore((s) => s.showToast);

  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { notifications } = await getNotifications({ limit: 100 });
      setItems(notifications);
    } catch {
      showToast('Could not load notifications', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleMarkAll = async () => {
    if (markingAll || items.length === 0) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      showToast('Could not mark all as read', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const handlePress = async (n: InAppNotification) => {
    if (openingId) return;
    const needsMark = !n.read;
    const needsNav = Boolean(n.postId);
    if (!needsMark && !needsNav) return;
    setOpeningId(n.id);
    try {
      if (needsMark) {
        const { notification } = await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? notification : x)));
      }
      if (needsNav && n.postId) {
        const post = await fetchPostById(n.postId);
        setCurrentEdit(post);
        router.push('/(tabs)/create' as any);
      }
    } catch {
      showToast('Could not open notification', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={() => void handleMarkAll()}
          disabled={markingAll || items.filter((i) => !i.read).length === 0}
          style={styles.markAllWrap}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text
              style={[
                styles.markAllText,
                items.filter((i) => !i.read).length === 0 && styles.markAllDisabled,
              ]}
            >
              Mark all read
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const unread = !item.read;
            return (
              <TouchableOpacity
                style={[styles.row, unread && styles.rowUnread]}
                onPress={() => void handlePress(item)}
                activeOpacity={0.82}
                disabled={openingId === item.id}
              >
                <View style={styles.rowInner}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowBody} numberOfLines={3}>
                    {item.body}
                  </Text>
                  <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                {openingId === item.id && (
                  <ActivityIndicator size="small" color={Colors.primary} style={styles.rowSpinner} />
                )}
              </TouchableOpacity>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { ...Typography.h3, flex: 1, textAlign: 'center', marginRight: 8 },
  markAllWrap: { minWidth: 96, alignItems: 'flex-end', justifyContent: 'center' },
  markAllText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  markAllDisabled: { color: Colors.textTertiary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textTertiary },
  row: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  rowInner: { padding: Spacing.md },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  rowBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  rowTime: { fontSize: 12, color: Colors.textTertiary, marginTop: 8 },
  rowSpinner: { position: 'absolute', right: Spacing.md, top: Spacing.md },
});
