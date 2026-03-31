import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Colors, BorderRadius, Shadows, Typography, Spacing } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

type Props = {
  visible: boolean;
  onAgree: () => void;
  onExit: () => void;
};

export default function LegalDisclosureModal({ visible, onAgree, onExit }: Props) {
  React.useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();

  const openTerms = () => {
    if (termsUrl) void WebBrowser.openBrowserAsync(termsUrl);
  };
  const openPrivacy = () => {
    if (privacyUrl) void WebBrowser.openBrowserAsync(privacyUrl);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.card}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
            >
              <Text style={styles.title}>Before we get started</Text>
              <Text style={styles.body}>
                Quickpost uses AI to generate content. AI can make mistakes — always review before
                publishing.
              </Text>
              <View style={styles.links}>
                {termsUrl ? (
                  <TouchableOpacity onPress={openTerms} activeOpacity={0.75} hitSlop={8}>
                    <Text style={styles.link}>Terms of Service</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.linkMuted}>Terms of Service (configure EXPO_PUBLIC_TERMS_URL)</Text>
                )}
                {privacyUrl ? (
                  <TouchableOpacity onPress={openPrivacy} activeOpacity={0.75} hitSlop={8}>
                    <Text style={styles.link}>Privacy Policy</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.linkMuted}>Privacy Policy (configure EXPO_PUBLIC_PRIVACY_URL)</Text>
                )}
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton title="Agree & Continue" onPress={onAgree} testID="legal-agree-btn" />
              <PrimaryButton title="Exit" onPress={onExit} variant="ghost" testID="legal-exit-btn" />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 27, 46, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  safe: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '88%',
    ...Shadows.card,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  links: {
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  linkMuted: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
});
