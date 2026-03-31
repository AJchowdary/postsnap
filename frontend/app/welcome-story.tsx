import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, GradientColors, Spacing, Typography } from '../src/constants/theme';
import PrimaryButton from '../src/components/PrimaryButton';
import { welcomeStorySeenStorageKey } from '../src/constants/welcomeStory';

const SLIDES = [
  {
    icon: 'sparkles' as const,
    title: 'Your Brand, Understood',
    body:
      'Paste your website and we build your Brand DNA automatically — colors, tone, services, and more.',
  },
  {
    icon: 'bulb-outline' as const,
    title: 'Content That Actually Fits',
    body: 'Get post ideas and captions written specifically for your business, not generic templates.',
  },
  {
    icon: 'rocket-outline' as const,
    title: 'Studio-Quality Images',
    body: 'Upload a product photo and get professional marketing images in seconds.',
  },
];

export default function WelcomeStoryScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const slideMinH = Math.max(height - 180, 420);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(welcomeStorySeenStorageKey(), '1');
    router.replace('/onboarding');
  }, [router]);

  const lastIndex = SLIDES.length - 1;

  return (
    <LinearGradient colors={GradientColors.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={finish} hitSlop={12} style={styles.skipBtn} testID="welcome-story-skip">
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const i = Math.round(x / Math.max(width, 1));
            setPage(Math.min(Math.max(i, 0), SLIDES.length - 1));
          }}
          decelerationRate="fast"
        >
          {SLIDES.map((slide, index) => (
            <View key={slide.title} style={[styles.slide, { width, minHeight: slideMinH }]}>
              <View style={styles.slideInner}>
                <View style={styles.iconCircle}>
                  <Ionicons name={slide.icon} size={56} color={Colors.textOnPrimary} />
                </View>
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideBody}>{slide.body}</Text>
              </View>
              {index === lastIndex ? (
                <View style={styles.ctaWrap}>
                  <PrimaryButton title="Let's go!" onPress={finish} testID="welcome-story-cta" />
                </View>
              ) : (
                <View style={styles.ctaSpacer} />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots} accessibilityRole="progressbar">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page && styles.dotActive,
                i === page && { width: 22 },
              ]}
            />
          ))}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    minHeight: 44,
  },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.3,
  },
  slide: {
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },
  slideInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  slideTitle: {
    ...Typography.title,
    color: Colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontSize: 26,
  },
  slideBody: {
    ...Typography.bodyLarge,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  ctaWrap: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    paddingBottom: Spacing.md,
  },
  ctaSpacer: { height: 72 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: Colors.textOnPrimary,
  },
});
