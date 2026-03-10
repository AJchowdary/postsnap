import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Start subscription (IAP purchase then verify). Called when user taps Upgrade Now. */
  onUpgrade?: () => void | Promise<void>;
  /** Restore purchases then verify. Called when user taps Restore Purchase. */
  onRestore?: () => void | Promise<void>;
}

const FEATURES = [
  { icon: 'flash', text: 'Post to Instagram + Facebook in one tap' },
  { icon: 'color-wand', text: 'On-brand AI edits + captions in seconds' },
  { icon: 'infinite', text: 'Unlimited posts for 1 business (fair use)' },
];

export default function PaywallModal({ visible, onClose, onUpgrade, onRestore }: PaywallModalProps) {
  const [loading, setLoading] = React.useState(false);
  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onUpgrade?.();
    } finally {
      setLoading(false);
    }
  };
  const handleRestore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onRestore?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity testID="paywall-close-btn" onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Quickpost Pro</Text>
              </View>
              <Text style={styles.headline}>
                Keep your social media{'\n'}active in 30 seconds a day
              </Text>
              <Text style={styles.subtext}>
                Your trial has ended. Upgrade to keep posting.
              </Text>
            </View>

            {/* Features */}
            <View style={styles.featuresCard}>
              {FEATURES.map((f, i) => (
                <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureBorder]}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon as any} size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>$12</Text>
              <Text style={styles.pricePer}>/month</Text>
            </View>
            <Text style={styles.fairUse}>Fair use applies · Cancel anytime</Text>

            {/* CTA */}
            <TouchableOpacity
              testID="paywall-upgrade-btn"
              onPress={handleUpgrade}
              disabled={loading}
              activeOpacity={0.85}
              style={styles.upgradeBtn}
            >
              <Text style={styles.upgradeBtnText}>{loading ? 'Please wait…' : 'Upgrade Now'}</Text>
            </TouchableOpacity>

            {/* Secondary */}
            <View style={styles.secondaryRow}>
              <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Restore Purchase</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="paywall-dismiss-btn" onPress={onClose} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  badge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: 16,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 20,
  },
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BorderRadius.xl,
    marginBottom: 24,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  featureBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
  },
  pricePer: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    marginLeft: 4,
  },
  fairUse: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  upgradeBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
});
