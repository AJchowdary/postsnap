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
import {
  authRegister,
  authLogin,
  bootstrapAccount,
  saveToken,
  updateBusinessProfile,
} from '../src/services/api';
import { defaultDisplayForBusinessType } from '../src/constants/businessTypeCatalog';
import type { BrandStyle, BusinessType } from '../src/types';
import { supabase } from '../src/lib/supabase';
import { signInWithGoogle, signInWithApple } from '../src/services/supabaseAuth';

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
  const [oauthLoading, setOauthLoading] = useState(false);

  const applyAccountToStore = (account: {
    name?: string;
    type?: string;
    displayType?: string;
    customDescription?: string;
    city?: string;
    brandStyle?: string;
    useLogoOverlay?: boolean;
    brandColor?: string;
    brandVibe?: string;
    dominantColors?: string[];
    websiteUrl?: string;
    websiteSummary?: string;
    toneExample?: string;
    instagramHandle?: string;
    facebookPage?: string;
    brandDnaSource?: string;
    businessSubcategory?: string;
    neighborhood?: string;
    tagline?: string;
    toneOfVoice?: string;
    contentPersona?: string;
    coreServices?: string[];
    heroProduct?: string;
    pricePositioning?: string;
    uniqueDifferentiator?: string;
    visualStyle?: string;
    photoStyleExamples?: string[];
    studioStylePreference?: string;
    studioBgColor?: string;
    seasonalContext?: string;
    localEvents?: string[];
    lastPostTopics?: string[];
    topPerformingAngles?: string[];
    preferredCaptionLength?: string;
    preferredPostingDays?: string[];
    photoStudioHistory?: Array<Record<string, unknown>>;
    confidenceOverall?: number;
    enrichmentVersion?: number;
  }) => {
    const t = (account.type || 'restaurant') as BusinessType;
    setBusinessProfile({
      name: account.name,
      type: t,
      displayType: account.displayType || defaultDisplayForBusinessType(t),
      customDescription: account.customDescription ?? '',
      city: account.city,
      brandStyle: (account.brandStyle || 'clean') as BrandStyle,
      useLogoOverlay: account.useLogoOverlay || false,
      brandColor: account.brandColor,
      brandVibe: account.brandVibe as import('../src/types').BusinessProfile['brandVibe'],
      dominantColors: account.dominantColors ?? [],
      websiteUrl: account.websiteUrl,
      websiteSummary: account.websiteSummary,
      toneExample: account.toneExample,
      instagramHandle: account.instagramHandle,
      facebookPage: account.facebookPage,
      brandDnaSource: account.brandDnaSource as import('../src/types').BusinessProfile['brandDnaSource'],
      businessSubcategory: account.businessSubcategory,
      neighborhood: account.neighborhood,
      tagline: account.tagline,
      toneOfVoice: account.toneOfVoice as import('../src/types').BusinessProfile['toneOfVoice'],
      contentPersona: account.contentPersona,
      coreServices: account.coreServices ?? [],
      heroProduct: account.heroProduct,
      pricePositioning: account.pricePositioning as import('../src/types').BusinessProfile['pricePositioning'],
      uniqueDifferentiator: account.uniqueDifferentiator,
      visualStyle: account.visualStyle as import('../src/types').BusinessProfile['visualStyle'],
      photoStyleExamples: account.photoStyleExamples ?? [],
      studioStylePreference: account.studioStylePreference as import('../src/types').BusinessProfile['studioStylePreference'],
      studioBgColor: account.studioBgColor,
      seasonalContext: account.seasonalContext,
      localEvents: account.localEvents ?? [],
      lastPostTopics: account.lastPostTopics ?? [],
      topPerformingAngles: account.topPerformingAngles ?? [],
      preferredCaptionLength: account.preferredCaptionLength as import('../src/types').BusinessProfile['preferredCaptionLength'],
      preferredPostingDays: account.preferredPostingDays ?? [],
      photoStudioHistory: account.photoStudioHistory ?? [],
      confidenceOverall: account.confidenceOverall,
      enrichmentVersion: account.enrichmentVersion,
    });
  };

  const navigateAfterAccount = (account: Parameters<typeof applyAccountToStore>[0]) => {
    if (account?.name?.trim()) {
      applyAccountToStore(account);
      setIsOnboarded(true);
      router.replace('/(tabs)/create');
    } else {
      router.replace('/onboarding');
    }
  };

  /** After Supabase OAuth / Apple: sync JWT to API client and bootstrap account. */
  const completeOAuthSession = async (appleDisplayName?: string | null) => {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session?.access_token) {
      throw new Error('Could not load your session. Try again.');
    }
    const session = sessionData.session;
    await saveToken(session.access_token);
    await setAuth(session.user.id, session.user.email ?? '', session.access_token);

    let account = await bootstrapAccount();
    const nameFromApple = appleDisplayName?.trim();
    if (nameFromApple && !account?.name?.trim()) {
      const t = (account.type || 'restaurant') as BusinessType;
      await updateBusinessProfile({
        name: nameFromApple,
        type: t,
        displayType: account.displayType || defaultDisplayForBusinessType(t),
        customDescription: account.customDescription ?? '',
        brandStyle: account.brandStyle || 'clean',
        useLogoOverlay: Boolean(account.useLogoOverlay),
      });
      account = await bootstrapAccount();
    }
    navigateAfterAccount(account);
  };

  const onGooglePress = async () => {
    if (isRegister && !agreeTerms) {
      showToast('Please agree to the Terms and Privacy Policy', 'error');
      return;
    }
    setOauthLoading(true);
    try {
      await signInWithGoogle();
      await completeOAuthSession();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      if (msg === 'Sign-in cancelled.' || msg.includes('cancelled')) {
        showToast('Sign-in cancelled', 'info');
      } else {
        showToast(msg.replace(/^Error:\s*/i, '').slice(0, 200), 'error');
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const onApplePress = async () => {
    if (isRegister && !agreeTerms) {
      showToast('Please agree to the Terms and Privacy Policy', 'error');
      return;
    }
    setOauthLoading(true);
    try {
      const { displayName } = await signInWithApple();
      await completeOAuthSession(displayName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      if (msg === 'Sign-in cancelled.' || msg.includes('cancelled')) {
        showToast('Sign-in cancelled', 'info');
      } else {
        showToast(msg.replace(/^Error:\s*/i, '').slice(0, 200), 'error');
      }
    } finally {
      setOauthLoading(false);
    }
  };

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
      await supabase.auth.signOut().catch(() => {});
      const fn = isRegister ? authRegister : authLogin;
      const result = await fn(email.trim().toLowerCase(), password);
      await setAuth(result.user.id, result.user.email, result.token);

      const account = await bootstrapAccount();
      navigateAfterAccount(account);
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
      colors={GradientColors.welcome}
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

              {/* To enable OAuth: configure providers in Supabase dashboard and add credentials to environment variables */}
              <View style={styles.oauthBlock}>
                  <TouchableOpacity
                    style={[styles.oauthBtn, oauthLoading && styles.oauthBtnDisabled]}
                    onPress={() => void onGooglePress()}
                    disabled={oauthLoading || loading}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-google" size={20} color={Colors.textPrimary} />
                    <Text style={styles.oauthBtnText}>Continue with Google</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={[styles.oauthBtn, styles.oauthApple, oauthLoading && styles.oauthBtnDisabled]}
                      onPress={() => void onApplePress()}
                      disabled={oauthLoading || loading}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="logo-apple" size={22} color={Colors.background} />
                      <Text style={styles.oauthBtnTextApple}>Continue with Apple</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or continue with email</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>

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
                        <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
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
                disabled={loading || oauthLoading}
                activeOpacity={0.85}
                style={[styles.submitWrap, (loading || oauthLoading) && { opacity: 0.6 }]}
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
    color: Colors.textOnPrimary,
    fontFamily: 'Manrope',
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: 'rgba(108, 99, 255, 0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },

  card: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: 'rgba(108, 99, 255, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },

  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 18,
  },

  oauthBlock: {
    marginBottom: 18,
    gap: 12,
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.input,
    paddingVertical: 14,
    minHeight: 52,
  },
  oauthApple: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  oauthBtnDisabled: {
    opacity: 0.5,
  },
  oauthBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'Inter',
  },
  oauthBtnTextApple: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    fontFamily: 'Inter',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cardSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
  },

  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    color: Colors.info,
    fontWeight: '500',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.input,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textMuted,
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
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textOnPrimary,
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
