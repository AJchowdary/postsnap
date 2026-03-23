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
      colors={['#eff6ff', '#f5f3ff', '#eef2ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
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
            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#4b5563" />
            </TouchableOpacity>

            {/* Card */}
            <View style={styles.card}>
              {/* Header */}
              <Text style={styles.cardTitle}>
                {isRegister ? 'Create Your Account' : 'Welcome back to Quickpost'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isRegister
                  ? 'Start your free 14-day trial'
                  : 'Continue to your account'}
              </Text>

              {/* Form fields */}
              <View style={styles.form}>
                {/* Full Name (register only) */}
                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor="#9ca3af"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        autoComplete="name"
                      />
                    </View>
                  </View>
                )}

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      testID="email-input"
                    />
                  </View>
                </View>

                {/* Business Name (register only, optional) */}
                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Business Name (Optional)</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="briefcase-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Your Business"
                        placeholderTextColor="#9ca3af"
                        value={businessName}
                        onChangeText={setBusinessName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <View style={styles.passwordHeader}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    {!isRegister && (
                      <TouchableOpacity>
                        <Text style={styles.forgotText}>Forgot password?</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.flex]}
                      placeholder={isRegister ? 'Min 8 characters' : '••••••••'}
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      testID="password-input"
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={8}>
                      <Ionicons
                        name={showPass ? 'eye-outline' : 'eye-off-outline'}
                        size={18}
                        color="#9ca3af"
                      />
                    </TouchableOpacity>
                  </View>
                  {isRegister && (
                    <Text style={styles.hint}>Must be at least 8 characters</Text>
                  )}
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
                  colors={['#2563eb', '#4f46e5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {isRegister ? 'Create Account' : 'Sign In'}
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
                    {isRegister ? 'Sign in' : 'Sign up'}
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
    paddingTop: 12,
    paddingBottom: 40,
    justifyContent: 'center',
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
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
  },

  form: {
    gap: 18,
    marginBottom: 24,
  },

  fieldGroup: { gap: 6 },
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
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
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
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2563eb',
    fontWeight: '600',
  },

  submitWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 20,
  },
  submitBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '700',
  },
});
