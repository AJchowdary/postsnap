import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Shadows, GradientColors } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import PrimaryButton from '../src/components/PrimaryButton';
import { scanWebsite, updateBusinessProfile } from '../src/services/api';
import { BusinessTypeSelector, BusinessTypeSelection } from '../src/components/BusinessTypeSelector';
import BrandColorPicker from '../src/components/BrandColorPicker';
import BrandVibePicker from '../src/components/BrandVibePicker';
import type { BrandVibe } from '../src/types';

type Flow = 'undecided' | 'manual' | 'website';

function progressDots(
  step: number,
  flow: Flow
): { key: string; state: 'done' | 'current' | 'upcoming' }[] {
  const labels = ['Basics', 'Website', 'Color', 'Review'];
  const mk = (currentIdx: number, allDone = false) =>
    labels.map((key, i) => ({
      key,
      state: (allDone ? 'done' : i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming') as
        | 'done'
        | 'current'
        | 'upcoming',
    }));

  if (flow === 'undecided') {
    if (step <= 1) return mk(0);
    if (step === 2) return mk(1);
    return mk(0);
  }

  if (flow === 'website') {
    if (step <= 1) return mk(0);
    if (step === 2) return mk(1);
    return mk(3, true);
  }
  if (flow === 'manual') {
    if (step <= 1) return mk(0);
    if (step === 2) return mk(1);
    if (step === 3) return mk(2);
    if (step === 4) return mk(3);
    return mk(3, true);
  }
  return mk(0);
}

export default function OnboardingScreen() {
  const router = useRouter();
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const showToast = useAppStore((s) => s.showToast);

  const [step, setStep] = useState(1);
  const [flow, setFlow] = useState<Flow>('undecided');

  const [bizSelection, setBizSelection] = useState<BusinessTypeSelection>({
    type: 'restaurant',
    displayType: 'Restaurant',
    customDescription: '',
  });
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');

  const [websiteUrlDraft, setWebsiteUrlDraft] = useState('');
  const [serverAccount, setServerAccount] = useState<Record<string, any> | null>(null);

  const [brandColor, setBrandColor] = useState('#2A9D8F');
  const [brandVibe, setBrandVibe] = useState<BrandVibe>('warm');

  const [saving, setSaving] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const dots = useMemo(() => progressDots(step, flow), [step, flow]);

  const goManual = () => {
    setFlow('manual');
    setStep(3);
  };

  const runWebsiteScan = async () => {
    const u = websiteUrlDraft.trim();
    if (!u) return;
    setScanBusy(true);
    try {
      const { account } = await scanWebsite(u);
      setServerAccount(account as Record<string, any>);
      setFlow('website');
      setStep(5);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not scan website. Try manual setup.', 'error');
    } finally {
      setScanBusy(false);
    }
  };

  const finishWebsite = async () => {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      const acc = serverAccount || {};
      await updateBusinessProfile({
        name: businessName.trim(),
        type: (acc.type || bizSelection.type) as string,
        displayType: bizSelection.displayType,
        customDescription: bizSelection.customDescription,
        city: city.trim() || undefined,
        brandColor: acc.brandColor || brandColor,
        brandVibe: acc.brandVibe || 'warm',
        dominantColors: acc.dominantColors || [],
        websiteUrl: acc.websiteUrl,
        websiteSummary: acc.websiteSummary,
        toneExample: acc.toneExample,
        instagramHandle: acc.instagramHandle,
        brandDnaSource: 'website',
        brandStyle: 'clean',
        useLogoOverlay: false,
      });
    } catch {
      // local store still updated
    } finally {
      setSaving(false);
    }
    setBusinessProfile({
      name: businessName.trim(),
      type: (serverAccount?.type || bizSelection.type) as any,
      displayType: bizSelection.displayType,
      customDescription: bizSelection.customDescription,
      city: city.trim() || undefined,
      brandColor: serverAccount?.brandColor,
      brandVibe: serverAccount?.brandVibe,
      dominantColors: serverAccount?.dominantColors ?? [],
      websiteUrl: serverAccount?.websiteUrl,
      websiteSummary: serverAccount?.websiteSummary,
      toneExample: serverAccount?.toneExample,
      instagramHandle: serverAccount?.instagramHandle,
      brandDnaSource: 'website',
      brandStyle: 'clean',
      useLogoOverlay: false,
    });
    setIsOnboarded(true);
    router.replace('/(tabs)/create');
  };

  const finishManual = async () => {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      await updateBusinessProfile({
        name: businessName.trim(),
        type: bizSelection.type,
        displayType: bizSelection.displayType,
        customDescription: bizSelection.customDescription,
        city: city.trim() || undefined,
        brandColor,
        brandVibe,
        dominantColors: [brandColor],
        brandDnaSource: 'manual',
        brandStyle: 'clean',
        useLogoOverlay: false,
      });
    } catch {
      // proceed
    } finally {
      setSaving(false);
    }
    setBusinessProfile({
      name: businessName.trim(),
      type: bizSelection.type,
      displayType: bizSelection.displayType,
      customDescription: bizSelection.customDescription,
      city: city.trim() || undefined,
      brandColor,
      brandVibe,
      dominantColors: [brandColor],
      brandDnaSource: 'manual',
      brandStyle: 'clean',
      useLogoOverlay: false,
    });
    setIsOnboarded(true);
    router.replace('/(tabs)/create');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.root}>
        <View style={styles.glow1} />
        <View style={styles.glow2} />

        <View style={styles.topBar}>
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>QP</Text>
            </View>
            <Text style={styles.appName}>Quickpost</Text>
          </View>
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
            <View style={styles.dotsRow}>
              {dots.map((d, i) => (
                <View
                  key={`${d.key}-${i}`}
                  style={[
                    styles.dot,
                    d.state === 'done' && { backgroundColor: Colors.primary },
                    d.state === 'current' && { backgroundColor: Colors.white },
                    d.state === 'upcoming' && { backgroundColor: Colors.border },
                  ]}
                />
              ))}
            </View>

            {step === 1 && (
              <>
                <Text style={styles.screenTitle}>Business basics</Text>
                <Text style={styles.screenSub}>Tell us who you are — it powers your AI captions.</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Business name *</Text>
                  <TextInput
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="e.g. The Tasty Fork"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                  />
                </View>

                <Text style={styles.sectionLabel}>Business type</Text>
                <BusinessTypeSelector variant="inline" value={bizSelection} onChange={setBizSelection} />

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>City / area</Text>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. San Francisco"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                  />
                </View>

                <View style={styles.footer}>
                  <PrimaryButton
                    title="Next"
                    onPress={() => {
                      if (!businessName.trim()) return;
                      setStep(2);
                    }}
                    disabled={!businessName.trim()}
                    icon={<Ionicons name="arrow-forward" size={18} color={Colors.white} />}
                  />
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setStep(1);
                    setFlow('undecided');
                  }}
                  style={styles.backRow}
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.screenTitle}>Do you have a website?</Text>
                <Text style={styles.screenSub}>We can build your brand profile automatically</Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.bigCard}
                  onPress={() => {
                    setFlow('website');
                  }}
                >
                  <Text style={styles.bigCardEmoji}>🌐</Text>
                  <Text style={styles.bigCardTitle}>Yes, scan my website</Text>
                  <Text style={styles.bigCardSub}>Enter your URL and AI does the rest</Text>
                </TouchableOpacity>

                {flow === 'website' && (
                  <View style={styles.scanBlock}>
                    <TextInput
                      value={websiteUrlDraft}
                      onChangeText={setWebsiteUrlDraft}
                      placeholder="https://yourbusiness.com"
                      placeholderTextColor={Colors.textTertiary}
                      autoCapitalize="none"
                      keyboardType="url"
                      style={styles.input}
                    />
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={runWebsiteScan}
                      disabled={!websiteUrlDraft.trim() || scanBusy}
                    >
                      <LinearGradient
                        colors={GradientColors.purple}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradBtn, (!websiteUrlDraft.trim() || scanBusy) && { opacity: 0.5 }]}
                      >
                        {scanBusy ? (
                          <ActivityIndicator color={Colors.background} />
                        ) : (
                          <Text style={styles.gradBtnText}>Scan & Continue</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity onPress={goManual} style={styles.manualLink}>
                  <Text style={styles.manualLinkText}>No website yet → Set up manually</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 3 && flow === 'manual' && (
              <>
                <TouchableOpacity onPress={() => setStep(2)} style={styles.backRow}>
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.screenTitle}>Pick your brand color</Text>
                <Text style={styles.screenSub}>This helps AI match your style</Text>
                <BrandColorPicker value={brandColor} onChange={setBrandColor} />
                <View style={styles.footer}>
                  <PrimaryButton title="Next" onPress={() => setStep(4)} />
                </View>
              </>
            )}

            {step === 4 && flow === 'manual' && (
              <>
                <TouchableOpacity onPress={() => setStep(3)} style={styles.backRow}>
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.screenTitle}>How would you describe your business?</Text>
                <Text style={styles.screenSub}>AI will match this personality in every post</Text>
                <BrandVibePicker value={brandVibe} onChange={setBrandVibe} />
                <View style={styles.footer}>
                  <PrimaryButton title="Next" onPress={() => setStep(5)} />
                </View>
              </>
            )}

            {step === 5 && (
              <>
                <Text style={styles.screenTitle}>
                  {flow === 'website' ? 'Review & confirm' : 'Review & confirm'}
                </Text>
                {flow === 'website' && serverAccount && (
                  <View style={styles.reviewCard}>
                    <Text style={styles.reviewOk}>✅ Website scanned successfully</Text>
                    <Text style={styles.reviewLabel}>Here&apos;s what we found</Text>
                    <Text style={styles.reviewBody}>{serverAccount.websiteSummary}</Text>
                    <View style={styles.reviewRow}>
                      {!!serverAccount.brandColor && (
                        <View style={[styles.miniSwatch, { backgroundColor: serverAccount.brandColor }]} />
                      )}
                      <Text style={styles.reviewMeta}>
                        Vibe: {serverAccount.brandVibe || 'warm'} · {businessName}
                      </Text>
                    </View>
                  </View>
                )}
                {flow === 'manual' && (
                  <View style={styles.reviewCard}>
                    <Text style={styles.reviewOk}>✅ Your brand profile is ready</Text>
                    <Text style={styles.reviewBody}>{businessName}</Text>
                    <View style={styles.reviewRow}>
                      <View style={[styles.miniSwatch, { backgroundColor: brandColor }]} />
                      <Text style={styles.reviewMeta}>Vibe: {brandVibe}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(2)} style={styles.manualLink}>
                      <Text style={styles.manualLinkText}>Add website later in Settings →</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.footer}>
                  <PrimaryButton
                    title={saving ? 'Saving…' : 'Start Creating Posts →'}
                    onPress={() => {
                      if (flow === 'website') void finishWebsite();
                      else void finishManual();
                    }}
                    loading={saving}
                    disabled={saving}
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

  glow1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: Colors.tertiary,
    opacity: 0.14,
    left: -100,
    top: 40,
  },
  glow2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.12,
    right: -80,
    top: 120,
  },

  topBar: {
    paddingHorizontal: Spacing.base,
    paddingTop: 10,
    paddingBottom: 8,
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
  logoText: { color: Colors.background, fontWeight: '900', fontSize: 16 },
  appName: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },

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
  },

  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Manrope',
  },
  screenSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 18, lineHeight: 20 },

  formGroup: { marginBottom: Spacing.base },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },
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

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 14, color: Colors.primary, fontWeight: '800' },

  bigCard: {
    backgroundColor: 'rgba(25,37,64,0.75)',
    borderRadius: BorderRadius.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(186,158,255,0.35)',
  },
  bigCardEmoji: { fontSize: 36, marginBottom: 8 },
  bigCardTitle: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary, marginBottom: 6 },
  bigCardSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  scanBlock: { gap: 12, marginBottom: 12 },
  gradBtn: {
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gradBtnText: { color: Colors.background, fontWeight: '900', fontSize: 15 },

  manualLink: { alignItems: 'center', paddingVertical: 12 },
  manualLinkText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  reviewCard: {
    backgroundColor: 'rgba(25,37,64,0.55)',
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  reviewOk: { fontSize: 15, fontWeight: '800', color: Colors.success },
  reviewLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  reviewBody: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  miniSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.white },
  reviewMeta: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },

  footer: { paddingTop: 18, gap: 12, marginTop: 10, paddingBottom: 22 },
});
