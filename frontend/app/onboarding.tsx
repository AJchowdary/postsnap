import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import { BusinessType } from '../src/types';
import PrimaryButton from '../src/components/PrimaryButton';
import { updateBusinessProfile } from '../src/services/api';

const BUSINESS_TYPES: Array<{ id: BusinessType; label: string; emoji: string; desc: string }> = [
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

  const [step, setStep] = useState(1);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>QP</Text>
            </View>
            <Text style={styles.appName}>Quickpost</Text>
            <Text style={styles.tagline}>Social posts in 30 seconds.</Text>
          </View>

          {step === 1 && (
            <>
              <Text style={styles.heading}>What type of business{'\n'}do you run?</Text>
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
                  title="Continue"
                  onPress={() => setStep(2)}
                  icon={<Ionicons name="arrow-forward" size={18} color={Colors.white} />}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backRow}>
                <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.heading}>Tell us about{'\n'}your business</Text>

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
                <Text style={styles.inputLabel}>City <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  testID="onboarding-city-input"
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. San Francisco"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={businessName.trim() ? handleGetStarted : undefined}
                />
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoText}>
                  You can connect Instagram & Facebook from Settings after signing up.
                </Text>
              </View>

              <View style={styles.footer}>
                <PrimaryButton
                  testID="onboarding-get-started-btn"
                  title={saving ? 'Saving…' : 'Get Started 🚀'}
                  onPress={handleGetStarted}
                  disabled={!businessName.trim() || saving}
                />
                <Text style={styles.trialNote}>Free 7-day trial · No credit card required</Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  logoSection: { alignItems: 'center', paddingTop: 40, paddingBottom: 32 },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...Shadows.primary,
  },
  logoText: { color: Colors.white, fontWeight: '900', fontSize: 24, letterSpacing: 1 },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  tagline: { fontSize: 15, color: Colors.textSecondary },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, lineHeight: 32, marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  typeList: { gap: Spacing.sm },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: Colors.paper, borderRadius: BorderRadius.lg,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadows.sm,
  },
  typeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 26 },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  typeLabelActive: { color: Colors.primary },
  typeDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  formGroup: { marginBottom: Spacing.base },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  optional: { fontWeight: '400', color: Colors.textTertiary },
  input: {
    backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: Colors.textPrimary, ...Shadows.sm,
  },
  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg,
    padding: 14, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.primaryMid,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },
  footer: { gap: 12, marginTop: 24 },
  trialNote: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary },
});
