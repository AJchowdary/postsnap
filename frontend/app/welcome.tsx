import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'time-outline' as const,
    title: 'Save Hours Daily',
    description: 'Post in 2 minutes instead of hours',
  },
  {
    icon: 'flash-outline' as const,
    title: 'Auto-Post Everywhere',
    description: 'Instagram, Facebook, Twitter, LinkedIn',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Grow Your Business',
    description: 'Stay consistent, boost engagement',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#eff6ff', '#f5f3ff', '#eef2ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Platform badge */}
          <View style={styles.badge}>
            <Ionicons name="phone-portrait-outline" size={14} color="#2563eb" />
            <Text style={styles.badgeText}>Available on iOS & Android</Text>
          </View>

          {/* Hero headline */}
          <Text style={styles.headline}>Social Media{'\n'}in 2 Minutes</Text>
          <Text style={styles.subtitle}>
            One photo. One line. Auto-posted everywhere.
            {'\n'}Perfect for busy business owners.
          </Text>

          {/* CTA Buttons */}
          <View style={styles.ctaGroup}>
            <TouchableOpacity
              onPress={() => router.push('/auth?mode=register')}
              activeOpacity={0.85}
              style={styles.primaryBtnWrap}
              testID="welcome-signup-btn"
            >
              <LinearGradient
                colors={['#2563eb', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/auth?mode=login')}
              activeOpacity={0.75}
              style={styles.secondaryBtn}
              testID="welcome-login-btn"
            >
              <Text style={styles.secondaryBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.trialNote}>
            14-day free trial • No credit card needed
          </Text>

          {/* Feature cards */}
          <View style={styles.featuresSection}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <LinearGradient
                  colors={['#dbeafe', '#e0e7ff']}
                  style={styles.featureIconWrap}
                >
                  <Ionicons name={f.icon} size={26} color="#2563eb" />
                </LinearGradient>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.description}</Text>
              </View>
            ))}
          </View>

          {/* Bottom CTA banner */}
          <LinearGradient
            colors={['#2563eb', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBanner}
          >
            <Text style={styles.ctaBannerTitle}>Ready to Save Time?</Text>
            <Text style={styles.ctaBannerSub}>
              Start your 14-day free trial today
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/auth?mode=register')}
              activeOpacity={0.85}
              style={styles.ctaBannerBtn}
            >
              <Text style={styles.ctaBannerBtnText}>Get Started Free</Text>
              <Ionicons name="arrow-forward" size={18} color="#2563eb" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLogo}>
              <LinearGradient
                colors={['#2563eb', '#4f46e5']}
                style={styles.footerLogoDot}
              />
              <Text style={styles.footerBrand}>Quickpost</Text>
            </View>
            <Text style={styles.footerTagline}>
              Social media made simple for busy business owners.
            </Text>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 28,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },

  headline: {
    fontSize: width > 400 ? 46 : 38,
    fontWeight: '800',
    color: '#1e1b4b',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: width > 400 ? 52 : 44,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 17,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
    maxWidth: 340,
  },

  ctaGroup: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
    marginBottom: 16,
  },
  primaryBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4f46e5',
  },

  trialNote: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },

  featuresSection: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featureIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  ctaBanner: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  ctaBannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  ctaBannerSub: {
    fontSize: 16,
    color: '#bfdbfe',
    marginBottom: 20,
  },
  ctaBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaBannerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },

  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  footerLogoDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  footerTagline: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
