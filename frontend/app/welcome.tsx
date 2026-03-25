import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, GradientColors } from '../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

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
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Ionicons name="sparkles" size={18} color={Colors.primary} />
            <Text style={styles.brandText}>Quickpost</Text>
          </View>

          <View style={styles.heroWrap}>
            <Text style={styles.headline}>Create content</Text>
            <LinearGradient
              colors={GradientColors.purple}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headlineGradient}
            >
              <Text style={styles.headlineAccent}>faster.</Text>
            </LinearGradient>
          </View>

          <Text style={styles.subtitle}>
            Elevate your digital presence with AI-driven precision
          </Text>

          <View style={styles.ctaGroup}>
            <TouchableOpacity
              onPress={() => router.push('/auth?mode=register')}
              activeOpacity={0.85}
              style={styles.primaryBtnWrap}
              testID="welcome-signup-btn"
            >
              <LinearGradient
                colors={GradientColors.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/auth?mode=login')}
              activeOpacity={0.75}
              style={styles.secondaryBtn}
              testID="welcome-login-btn"
            >
              <Text style={styles.secondaryBtnText}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glow1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: Colors.tertiary,
    opacity: 0.16,
    left: -90,
    top: 40,
  },
  glow2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.15,
    right: -70,
    top: 150,
  },
  glow3: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: Colors.secondary,
    opacity: 0.12,
    left: -120,
    bottom: -90,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 30,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    fontFamily: 'Manrope',
  },

  heroWrap: { alignItems: 'center', marginBottom: 14 },
  headline: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1.1,
    lineHeight: 48,
    fontFamily: 'Manrope',
  },
  headlineGradient: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  headlineAccent: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 48,
    color: Colors.background,
    fontFamily: 'Manrope',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 330,
    fontFamily: 'Inter',
  },

  ctaGroup: {
    width: '100%',
    maxWidth: 320,
    gap: 14,
  },
  primaryBtnWrap: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: BorderRadius.full,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.background,
    fontFamily: 'Manrope',
  },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(20,31,56,0.6)',
  },
  secondaryBtnText: {
    fontWeight: '800',
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: 'Manrope',
  },
});
