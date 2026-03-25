import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Shadows, GradientColors } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import { BusinessType } from '../src/types';
import PrimaryButton from '../src/components/PrimaryButton';
import { updateBusinessProfile } from '../src/services/api';

const BUSINESS_TYPES: { id: BusinessType; label: string; emoji: string; desc: string }[] = [
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️', desc: 'Dine-in, takeaway, food delivery' },
  { id: 'salon', label: 'Salon/Tattoo', emoji: '💅', desc: 'Hair, beauty, tattoo & piercing' },
  { id: 'retail', label: 'Retail', emoji: '🛍️', desc: 'Shop, boutique, online store' },
  { id: 'gym', label: 'Gym/Fitness', emoji: '💪', desc: 'Gym, studio, personal training' },
  { id: 'cafe', label: 'Café', emoji: '☕', desc: 'Coffee shop, bakery, café' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<BusinessType>('restaurant');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGetStarted = async () => {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      await updateBusinessProfile({
        name: businessName.trim(),
        type: selectedType,
        city: city.trim() || undefined,
        brandStyle: 'clean',
        useLogoOverlay: false,
      });
    } catch {
      // proceed anyway, store locally
    } finally {
      setSaving(false);
    }
    setBusinessProfile({
      name: businessName.trim(),
      type: selectedType,
      city: city.trim() || undefined,
    });
    setIsOnboarded(true);
    router.replace('/(tabs)/create');
  };

  const skip = () => {
    // Skip slide content, but keep the required business name inputs visible on step 3.
    setStep(3);
  };

  const slides = [
    {
      title: 'Generate posts instantly',
      body: 'Transform your raw ideas into high-performing social media content with a single tap',
    },
    {
      title: 'AI enhances your photos',
      body: 'Upload any image and our AI will optimize it for Instagram and Facebook',
    },
    {
      title: 'Connect and publish',
      body: 'Connect your Instagram and Facebook accounts and post with one tap',
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.root}>
        {/* Ambient glows */}
        <View style={styles.glow1} />
        <View style={styles.glow2} />
        <View style={styles.glow3} />

        {/* Skip (top right) */}
        <View style={styles.topBar}>
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>QP</Text>
            </View>
            <Text style={styles.appName}>Quickpost</Text>
          </View>
          <TouchableOpacity onPress={skip} style={styles.skipLink} testID="onboarding-skip-link">
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Dots indicator */}
            <View style={styles.dotsRow}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.dot,
                    step === n && { backgroundColor: Colors.primary },
                  ]}
                />
              ))}
            </View>

            {/* Slide content */}
            <View style={styles.slideCard}>
              <Text style={styles.slideTitle}>{slides[step - 1].title}</Text>
              <Text style={styles.slideBody}>{slides[step - 1].body}</Text>
            </View>

            {step === 1 && (
              <>
                <View style={styles.sectionGap} />
                <Text style={styles.sectionLabel}>Business type</Text>
                <View style={styles.typeList}>
                  {BUSINESS_TYPES.map((bt) => (
                    <TouchableOpacity
                      key={bt.id}
                      testID={`onboarding-type-${bt.id}`}
                      onPress={() => setSelectedType(bt.id)}
                      activeOpacity={0.8}
                      style={[styles.typeCard, selectedType === bt.id && styles.typeCardActive]}
                    >
                      <Text style={styles.typeEmoji}>{bt.emoji}</Text>
                      <View style={styles.typeInfo}>
                        <Text style={[styles.typeLabel, selectedType === bt.id && styles.typeLabelActive]}>
                          {bt.label}
                        </Text>
                        <Text style={styles.typeDesc}>{bt.desc}</Text>
                      </View>
                      {selectedType === bt.id && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.footer}>
                  <PrimaryButton
                    testID="onboarding-next-btn"
                    title="Next"
                    onPress={() => setStep(2)}
                    icon={<Ionicons name="arrow-forward" size={18} color={Colors.white} />}
                  />
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <TouchableOpacity onPress={() => setStep(1)} style={styles.backRow} testID="onboarding-back-btn">
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <View style={styles.sectionGap} />
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Business Name *</Text>
                  <TextInput
                    testID="onboarding-biz-name-input"
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="e.g. The Tasty Fork"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    returnKeyType="next"
                    autoFocus
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    City <Text style={styles.optional}>(optional)</Text>
                  </Text>
                  <TextInput
                    testID="onboarding-city-input"
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. San Francisco"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={businessName.trim() ? () => setStep(3) : undefined}
                  />
                </View>

                <View style={styles.infoCard}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.infoText}>Connect Instagram & Facebook from Settings after you sign up.</Text>
                </View>

                <View style={styles.footer}>
                  <PrimaryButton
                    testID="onboarding-next-btn-step2"
                    title="Next"
                    onPress={() => setStep(3)}
                    disabled={!businessName.trim() || saving}
                    loading={saving}
                  />
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <View style={styles.sectionGap} />

                <View style={styles.illustrationCard}>
                  <LinearGradient
                    colors={GradientColors.purple}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.illustrationGradient}
                  >
                    <View style={styles.illustrationInner}>
                      <Ionicons name="sparkles" size={30} color={Colors.background} />
                      <Text style={styles.illustrationText}>Quickpost turns ideas into ready-to-post content.</Text>
                    </View>
                  </LinearGradient>
                </View>

                <View style={styles.sectionGap} />
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Business Name *</Text>
                  <TextInput
                    testID="onboarding-biz-name-input-step3"
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="e.g. The Tasty Fork"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    returnKeyType="done"
                    autoFocus
                    onSubmitEditing={businessName.trim() ? handleGetStarted : undefined}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    City <Text style={styles.optional}>(optional)</Text>
                  </Text>
                  <TextInput
                    testID="onboarding-city-input-step3"
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. San Francisco"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.footer}>
                  <PrimaryButton
                    testID="onboarding-get-started-btn"
                    title={saving ? 'Saving…' : 'Next'}
                    onPress={handleGetStarted}
                    disabled={!businessName.trim() || saving}
                    loading={saving}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  root: { flex: 1, position: 'relative' },
  kav: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: 34 },

  // Background glows
  glow1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: Colors.tertiary,
    opacity: 0.16,
    left: -120,
    top: 60,
  },
  glow2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.14,
    right: -90,
    top: 150,
  },
  glow3: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
    opacity: 0.12,
    left: -110,
    bottom: -120,
  },

  topBar: {
    paddingHorizontal: Spacing.base,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  logoText: { color: Colors.background, fontWeight: '900', fontSize: 16, letterSpacing: 0.4 },
  appName: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3 },

  skipLink: { paddingHorizontal: 8, paddingVertical: 8 },
  skipText: { color: Colors.textSecondary, fontWeight: '700' },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },

  slideCard: {
    borderRadius: BorderRadius.xl,
    padding: 18,
    backgroundColor: 'rgba(25,37,64,0.55)',
    marginBottom: 10,
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
    fontFamily: 'Manrope',
    marginBottom: 8,
  },
  slideBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    fontFamily: 'Inter',
  },

  sectionGap: { height: 10 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 10,
  },

  typeList: { gap: Spacing.sm },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  typeCardActive: { backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 26 },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  typeLabelActive: { color: Colors.primary },
  typeDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 6 },
  backText: { fontSize: 14, color: Colors.primary, fontWeight: '800' },

  formGroup: { marginBottom: Spacing.base },
  inputLabel: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, marginBottom: 10 },
  input: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    ...Shadows.sm,
  },
  optional: { fontWeight: '400', color: Colors.textTertiary },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(186,158,255,0.14)',
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: Spacing.xl,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },
  illustrationCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: Colors.paper,
    ...Shadows.md,
  },
  illustrationGradient: { padding: 16, minHeight: 120 },
  illustrationInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  illustrationText: {
    fontSize: 13,
    color: Colors.background,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Manrope',
  },

  footer: { paddingTop: 18, gap: 12, marginTop: 10, paddingBottom: 22 },
});
