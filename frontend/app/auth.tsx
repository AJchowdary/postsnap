import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { BorderRadius, Colors, GradientColors } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import { authRegister, authLogin, bootstrapAccount } from '../src/services/api';
import { defaultDisplayForBusinessType } from '../src/constants/businessTypeCatalog';
import type { BusinessType } from '../src/types';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isRegister = (params.mode ?? 'login') === 'register';

  const setAuth = useAppStore((s) => s.setAuth);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const showToast = useAppStore((s) => s.showToast);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (isRegister && !agreeTerms) {
      showToast('Please agree to the Terms and Privacy Policy', 'error');
      return;
    }
    setLoading(true);
    try {
      const fn = isRegister ? authRegister : authLogin;
      const result = await fn(email.trim().toLowerCase(), password);
      await setAuth(result.user.id, result.user.email, result.token);

      const account = await bootstrapAccount();
      if (account?.name) {
        const t = (account.type || 'restaurant') as BusinessType;
        setBusinessProfile({
          name: account.name,
          type: t,
          displayType: account.displayType || defaultDisplayForBusinessType(t),
          customDescription: account.customDescription ?? '',
          city: account.city,
          brandStyle: account.brandStyle || 'clean',
          useLogoOverlay: account.useLogoOverlay || false,
          brandColor: account.brandColor,
          brandVibe: account.brandVibe,
          dominantColors: account.dominantColors ?? [],
          websiteUrl: account.websiteUrl,
          websiteSummary: account.websiteSummary,
          toneExample: account.toneExample,
          instagramHandle: account.instagramHandle,
          facebookPage: account.facebookPage,
          brandDnaSource: account.brandDnaSource ?? 'manual',
          businessSubcategory: account.businessSubcategory,
          neighborhood: account.neighborhood,
          tagline: account.tagline,
          toneOfVoice: account.toneOfVoice,
          contentPersona: account.contentPersona,
          coreServices: account.coreServices ?? [],
          heroProduct: account.heroProduct,
          pricePositioning: account.pricePositioning,
          uniqueDifferentiator: account.uniqueDifferentiator,
          visualStyle: account.visualStyle,
          photoStyleExamples: account.photoStyleExamples ?? [],
          studioStylePreference: account.studioStylePreference,
          studioBgColor: account.studioBgColor,
          seasonalContext: account.seasonalContext,
          localEvents: account.localEvents ?? [],
          lastPostTopics: account.lastPostTopics ?? [],
          topPerformingAngles: account.topPerformingAngles ?? [],
          preferredCaptionLength: account.preferredCaptionLength,
          preferredPostingDays: account.preferredPostingDays ?? [],
          photoStudioHistory: account.photoStudioHistory ?? [],
          confidenceOverall: account.confidenceOverall,
          enrichmentVersion: account.enrichmentVersion,
        });
        setIsOnboarded(true);
        router.replace('/(tabs)/create');
      } else {
        router.replace('/onboarding');
      }
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        showToast('Email already registered. Try logging in.', 'error');
      } else if (err.message?.includes('Invalid email')) {
        showToast('Invalid email or password', 'error');
      } else {
        showToast(err.message || 'Something went wrong', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const openTerms = () => {
    const url = process.env.EXPO_PUBLIC_TERMS_URL;
    if (url) WebBrowser.openBrowserAsync(url);
  };

  const openPrivacy = () => {
    const url = process.env.EXPO_PUBLIC_PRIVACY_URL;
    if (url) WebBrowser.openBrowserAsync(url);
  };

  const switchMode = () => {
    router.replace(`/auth?mode=${isRegister ? 'login' : 'register'}` as any);
  };

  return (
    <LinearGradient
      colors={GradientColors.dark}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <View style={styles.glow1} />
      <View style={styles.glow2} />
      <View style={styles.glow3} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandArea}>
              <View style={styles.brandRow}>
                <Ionicons name="sparkles" size={22} color={Colors.primary} />
                <LinearGradient
                  colors={GradientColors.purple}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.brandTextBg}
                >
                  <Text style={styles.brandText}>Quickpost</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Card */}
            <View style={styles.card}>
              {/* Header */}
              <Text style={styles.cardTitle}>
                {isRegister ? 'Create your account' : 'Welcome back'}
              </Text>

              {/* Form fields */}
              <View style={styles.form}>
                {/* Email */}
                <View style={styles.fieldGroup}>
                  <View style={styles.inputWrap}>
                    <Ionicons name="at-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.textSecondary}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      testID="email-input"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={Colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={isRegister ? 'Min 8 characters' : '••••••••'}
                      placeholderTextColor={Colors.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      testID="password-input"
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={10}>
                      <Ionicons
                        name={showPass ? 'eye-outline' : 'eye-off-outline'}
                        size={18}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Terms checkbox (register only) */}
                {isRegister && (
                  <TouchableOpacity
                    style={styles.termsRow}
                    onPress={() => setAgreeTerms(!agreeTerms)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                      {agreeTerms && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.termsText}>
                      I agree to the{' '}
                      <Text style={styles.termsLink} onPress={openTerms}>
                        Terms of Service
                      </Text>{' '}
                      and{' '}
                      <Text style={styles.termsLink} onPress={openPrivacy}>
                        Privacy Policy
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Submit button */}
              <TouchableOpacity
                testID="auth-submit"
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.submitWrap, loading && { opacity: 0.6 }]}
              >
                <LinearGradient
                  colors={GradientColors.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.submitText}>
                      {isRegister ? 'Sign Up' : 'Login'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer toggle */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>
                  {isRegister
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                </Text>
                <TouchableOpacity onPress={switchMode}>
                  <Text style={styles.footerLink}>
                    {isRegister ? 'Login' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Background ambient glows
  glow1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: Colors.tertiary,
    opacity: 0.18,
    left: -90,
    top: 40,
  },
  glow2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.16,
    right: -70,
    top: 120,
  },
  glow3: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
    opacity: 0.12,
    left: -110,
    bottom: -120,
  },

  // Brand
  brandArea: { alignItems: 'center', marginBottom: 26 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTextBg: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  brandText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: Colors.background,
    fontFamily: 'Manrope',
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  card: {
    backgroundColor: 'rgba(25,37,64,0.6)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },

  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
  },

  form: {
    gap: 14,
    marginBottom: 18,
  },

  fieldGroup: { gap: 10 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: 'Inter',
  },

  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(64,72,93,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '700',
  },

  submitWrap: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 18,
  },
  submitBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    minHeight: 52,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.background,
    fontFamily: 'Manrope',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '800',
  },
});
