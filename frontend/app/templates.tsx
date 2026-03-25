import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BG = '#0d0d0d';
const CARD = '#141414';

type Category = { name: string; images: string[] };

const CATEGORIES: Category[] = [
  {
    name: 'Abstract',
    images: [
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=200&h=120&fit=crop',
    ],
  },
  {
    name: 'Fantasy',
    images: [
      'https://images.unsplash.com/photo-1518655048521-f130df041f66?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=120&fit=crop',
    ],
  },
  {
    name: 'Nature',
    images: [
      'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=120&fit=crop',
    ],
  },
  {
    name: 'Food & Restaurant',
    images: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=120&fit=crop',
    ],
  },
  {
    name: 'Fashion & Style',
    images: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=200&h=120&fit=crop',
    ],
  },
  {
    name: 'Minimalist',
    images: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=120&fit=crop',
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=120&fit=crop',
    ],
  },
];

function slugFromCategory(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function TemplatesScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CATEGORIES;
    return CATEGORIES.filter((c) => c.name.toLowerCase().includes(s));
  }, [q]);

  const goBackWithStyle = (templateStyle: string) => {
    const slug = slugFromCategory(templateStyle);
    router.replace({
      pathname: '/(tabs)/create',
      params: { templateStyle: slug },
    } as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Templates</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search templates..."
          placeholderTextColor="#666"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.map((cat) => (
            <View key={cat.name} style={styles.section}>
              <TouchableOpacity
                style={styles.catRow}
                activeOpacity={0.85}
                onPress={() => goBackWithStyle(cat.name)}
              >
                <Text style={styles.catTitle}>{cat.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#ba9eff" />
              </TouchableOpacity>
              <View style={styles.imgRow}>
                {cat.images.map((uri, i) => (
                  <TouchableOpacity
                    key={uri + i}
                    activeOpacity={0.85}
                    onPress={() => goBackWithStyle(cat.name)}
                    style={styles.thumbWrap}
                  >
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  scroll: { paddingBottom: 40, paddingHorizontal: 16 },
  section: { marginBottom: 28 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  catTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  imgRow: { flexDirection: 'row', gap: 8 },
  thumbWrap: { flex: 1, borderRadius: 12, overflow: 'hidden', height: 100 },
  thumb: { width: '100%', height: '100%' },
});
