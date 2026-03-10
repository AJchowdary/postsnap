import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, GradientColors } from '../src/constants/theme';

const { width, height } = Dimensions.get('window');

const HERO = 'https://static.prod-images.emergentagent.com/jobs/8b3d0938-fc5f-4047-907f-b35f85b7b19e/images/e13497104f07df3e0abe626ed3d71b63d01f0a33e0ec7ad51af21475a9a47fe6.png';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Background glow blobs */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <SafeAreaView style={styles.safe}>
        {/* Top: App name */}
        <View style={styles.header}>
          <Text style={styles.welcomeTo}>Welcome to</Text>
          <LinearGradient
            colors={GradientColors.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nameGradient}
          >
            <Text style={styles.appName}>Quickpost</Text>
          </LinearGradient>
          <Text style={styles.tagline}>Social content for local businesses</Text>
        </View>

        {/* Hero image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: HERO }}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        {/* Bottom action area */}
        <View style={styles.bottom}>
          {/* Sign Up — gradient */}
          <TouchableOpacity
            onPress={() => router.push('/auth?mode=register')}
            activeOpacity={0.85}
            style={styles.signUpWrap}
            testID="welcome-signup-btn"
          >
            <LinearGradient
              colors={GradientColors.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signUpBtn}
            >
              <Text style={styles.signUpText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Log In — outlined */}
          <TouchableOpacity
            onPress={() => router.push('/auth?mode=login')}
            activeOpacity={0.75}
            style={styles.loginBtn}
            testID="welcome-login-btn"
          >
            <Text style={styles.loginText}>Log In to Quickpost</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <Text style={styles.continueWith}>Continue with</Text>
          <View style={styles.socialRow}>
            <SocialBtn icon="🍎" />
            <SocialBtn icon="G" isGoogle />
            <SocialBtn icon="f" isFacebook />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SocialBtn({ icon, isGoogle, isFacebook }: { icon: string; isGoogle?: boolean; isFacebook?: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.socialBtn, isFacebook && { backgroundColor: '#1877f2' }]}
    >
      <Text style={[styles.socialIcon, isGoogle && { color: '#ea4335' }, isFacebook && { color: '#fff' }]}>
        {icon}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Background glow blobs
  blob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.18,
  },
  blobTop: {
    backgroundColor: '#8b5cf6',
    top: -80,
    right: -60,
  },
  blobBottom: {
    backgroundColor: '#f43f5e',
    bottom: 80,
    left: -80,
    opacity: 0.13,
  },

  safe: { flex: 1 },

  // Header
  header: { alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  welcomeTo: { fontSize: 16, color: Colors.textSecondary, marginBottom: 4 },
  nameGradient: { borderRadius: 8, paddingHorizontal: 4 },
  appName: { fontSize: 40, fontWeight: '900', color: Colors.white, letterSpacing: -1 },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },

  // Hero
  heroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  heroImage: {
    width: width * 0.7,
    height: width * 0.85,
    maxHeight: height * 0.38,
  },

  // Bottom CTAs
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  signUpWrap: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  signUpBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  signUpText: { fontSize: 17, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  loginBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  loginText: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },

  // Social
  continueWith: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  socialIcon: { fontSize: 20, color: Colors.white, fontWeight: '700' },
});
