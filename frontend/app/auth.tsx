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
import { Colors, Spacing, BorderRadius, GradientColors } from '../src/constants/theme';
import { useAppStore } from '../src/store/appStore';
import { authRegister, authLogin, bootstrapAccount } from '../src/services/api';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isRegister = (params.mode ?? 'login') === 'register';

  const setAuth = useAppStore((s) => s.setAuth);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const showToast = useAppStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = isRegister ? 'Set up your Quickpost' : 'Welcome Back to Quickpost';
  const subtitle = isRegister
    ? 'Create a free account to start posting in 30 seconds'
    : 'Log back in to keep your social media active';

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const fn = isRegister ? authRegister : authLogin;
      const result = await fn(email.trim().toLowerCase(), password);
      await setAuth(result.user.id, result.user.email, result.token);

      const account = await bootstrapAccount();
      if (account?.name) {
        setBusinessProfile({
          name: account.name,
          type: account.type || 'restaurant',
          city: account.city,
          brandStyle: account.brandStyle || 'clean',
          useLogoOverlay: account.useLogoOverlay || false,
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

  return (
    <View style={styles.root}>
      {/* Background glow */}
      <View style={[styles.blob, styles.blobPurple]} />
      <View style={[styles.blob, styles.blobPink]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.textTertiary}
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
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={isRegister ? 'Min 8 characters' : 'Your password'}
                    placeholderTextColor={Colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    testID="password-input"
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password (login only) */}
              {!isRegister && (
                <TouchableOpacity style={styles.forgot}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* CTA button */}
            <TouchableOpacity
              testID="auth-submit"
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.ctaWrap, loading && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={GradientColors.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.ctaText}>{isRegister ? 'Create Account' : 'Log In'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Footer link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.replace(`/auth?mode=${isRegister ? 'login' : 'register'}` as any)
                }
              >
                <Text style={styles.footerLink}>{isRegister ? 'Log In' : 'Sign Up'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  blob: { position: 'absolute', borderRadius: 200, opacity: 0.16 },
  blobPurple: { width: 280, height: 280, backgroundColor: '#7c3aed', top: -60, right: -40 },
  blobPink: { width: 220, height: 220, backgroundColor: '#f43f5e', bottom: 120, left: -60, opacity: 0.10 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },

  header: { marginBottom: Spacing.xxl },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
    lineHeight: 34,
  },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  form: { gap: Spacing.lg, marginBottom: Spacing.xl },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: 15, color: Colors.white },
  eyeBtn: { padding: 4 },

  forgot: { alignSelf: 'flex-end' },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

  ctaWrap: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: Spacing.xl,
  },
  ctaBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },

  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
});
