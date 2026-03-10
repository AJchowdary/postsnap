import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import { BusinessType, BrandStyle } from '../../src/types';
import StatusChip from '../../src/components/StatusChip';
import PrimaryButton from '../../src/components/PrimaryButton';
import { connectSocialAccount, disconnectSocialAccount, updateBusinessProfile } from '../../src/services/api';
import { purchaseSubscription, restorePurchases, refreshSubscriptionFromBackend } from '../../src/services/iapService';

const BUSINESS_TYPES: Array<{ id: BusinessType; label: string; emoji: string }> = [
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { id: 'salon', label: 'Salon/Tattoo', emoji: '💅' },
  { id: 'retail', label: 'Retail', emoji: '🛍️' },
  { id: 'gym', label: 'Gym', emoji: '💪' },
  { id: 'cafe', label: 'Café', emoji: '☕' },
];

const BRAND_STYLES: Array<{ id: BrandStyle; label: string; desc: string }> = [
  { id: 'clean', label: 'Clean', desc: 'Bright, minimal, clear' },
  { id: 'bold', label: 'Bold', desc: 'Rich colors, energetic' },
  { id: 'minimal', label: 'Minimal', desc: 'Soft tones, airy' },
];

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon, iconBg, label, sublabel, rightEl, onPress, testID,
}: {
  icon: string; iconBg: string; label: string; sublabel?: string;
  rightEl?: React.ReactNode; onPress?: () => void; testID?: string;
}) {
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row testID={testID} onPress={onPress} activeOpacity={0.75} style={styles.settingsRow}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={16} color={Colors.white} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel} numberOfLines={1}>{sublabel}</Text>}
      </View>
      {rightEl || (onPress && <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />)}
    </Row>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const socialAccounts = useAppStore((s) => s.socialAccounts);
  const subscription = useAppStore((s) => s.subscription);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setSocialAccount = useAppStore((s) => s.setSocialAccount);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const showToast = useAppStore((s) => s.showToast);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const clearAuth = useAppStore((s) => s.clearAuth);

  const [editingBusiness, setEditingBusiness] = useState(false);
  const [bizName, setBizName] = useState(businessProfile.name);
  const [bizCity, setBizCity] = useState(businessProfile.city || '');
  const [bizType, setBizType] = useState<BusinessType>(businessProfile.type);
  const [brandStyle, setBrandStyle] = useState<BrandStyle>(businessProfile.brandStyle);
  const [useLogoOverlay, setUseLogoOverlay] = useState(businessProfile.useLogoOverlay);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');

  const saveBusiness = async () => {
    if (!bizName.trim()) { showToast('Business name is required', 'error'); return; }
    const profile = { name: bizName.trim(), city: bizCity.trim() || undefined, type: bizType, brandStyle, useLogoOverlay };
    setBusinessProfile(profile);
    setEditingBusiness(false);
    try {
      await updateBusinessProfile(profile);
      showToast('Business info updated', 'success');
    } catch {
      showToast('Saved locally (offline)', 'info');
    }
  };

  const handleConnect = async (platform: 'instagram' | 'facebook') => {
    if (!handleInput.trim()) { showToast('Enter your handle', 'error'); return; }
    try {
      await connectSocialAccount(platform, handleInput.trim());
      setSocialAccount(platform, { platform, handle: handleInput.trim(), connected: true });
      setConnectingPlatform(null);
      setHandleInput('');
      showToast(`${platform} connected!`, 'success');
    } catch {
      showToast('Connection failed', 'error');
    }
  };

  const handleDisconnect = (platform: 'instagram' | 'facebook') => {
    Alert.alert('Disconnect', `Disconnect ${platform}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await disconnectSocialAccount(platform);
          setSocialAccount(platform, null);
          showToast(`${platform} disconnected`, 'info');
        },
      },
    ]);
  };

  const openLegalUrl = async (url: string | undefined, label: string) => {
    const u = url?.trim();
    if (!u || !u.startsWith('http')) {
      showToast(`${label} URL not configured`, 'info');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(u, { controlsColor: Colors.primary });
    } catch {
      Linking.openURL(u).catch(() => showToast(`Could not open ${label}`, 'error'));
    }
  };

  const handleStartSubscription = async () => {
    const result = await purchaseSubscription(() => refreshSubscriptionFromBackend(setSubscription));
    if (result.success) {
      setShowPaywall(false);
      showToast('Subscription activated!', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleRestore = async () => {
    const result = await restorePurchases(() => refreshSubscriptionFromBackend(setSubscription));
    if (result.success) {
      setShowPaywall(false);
      showToast('Purchases restored', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/welcome');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} testID="settings-title">Settings</Text>
        </View>

        {/* ---- Business Info ---- */}
        <SectionHeader title="Business" />
        <View style={styles.card}>
          {!editingBusiness ? (
            <>
              <SettingsRow
                icon="storefront-outline"
                iconBg={Colors.primary}
                label={businessProfile.name}
                sublabel={`${businessProfile.type} ${businessProfile.city ? `· ${businessProfile.city}` : ''}`}
                onPress={() => setEditingBusiness(true)}
                testID="settings-business-row"
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="color-palette-outline"
                iconBg="#8b5cf6"
                label="Brand Style"
                sublabel={brandStyle.charAt(0).toUpperCase() + brandStyle.slice(1)}
                onPress={() => setEditingBusiness(true)}
              />
              <View style={styles.divider} />
              <View style={styles.settingsRow}>
                <View style={[styles.rowIcon, { backgroundColor: '#0ea5e9' }]}>
                  <Ionicons name="layers-outline" size={16} color={Colors.white} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Logo Overlay</Text>
                  <Text style={styles.rowSublabel}>Show logo on posts by default</Text>
                </View>
                <Switch
                  testID="logo-overlay-switch"
                  value={useLogoOverlay}
                  onValueChange={(v) => { setUseLogoOverlay(v); setBusinessProfile({ useLogoOverlay: v }); }}
                  trackColor={{ false: Colors.border, true: Colors.primaryMid }}
                  thumbColor={useLogoOverlay ? Colors.primary : Colors.white}
                />
              </View>
            </>
          ) : (
            <View style={styles.editForm}>
              <Text style={styles.editFormTitle}>Edit Business Info</Text>

              <Text style={styles.inputLabel}>Business Name</Text>
              <TextInput
                testID="settings-biz-name-input"
                value={bizName}
                onChangeText={setBizName}
                style={styles.input}
                placeholder="Your business name"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                value={bizCity}
                onChangeText={setBizCity}
                style={styles.input}
                placeholder="e.g. San Francisco"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.inputLabel}>Business Type</Text>
              <View style={styles.typeGrid}>
                {BUSINESS_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt.id}
                    testID={`biz-type-${bt.id}`}
                    onPress={() => setBizType(bt.id)}
                    activeOpacity={0.8}
                    style={[styles.typeChip, bizType === bt.id && styles.typeChipActive]}
                  >
                    <Text style={styles.typeEmoji}>{bt.emoji}</Text>
                    <Text style={[styles.typeLabel, bizType === bt.id && styles.typeLabelActive]}>{bt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Brand Style</Text>
              <View style={styles.brandStyleRow}>
                {BRAND_STYLES.map((bs) => (
                  <TouchableOpacity
                    key={bs.id}
                    testID={`brand-style-${bs.id}`}
                    onPress={() => setBrandStyle(bs.id)}
                    activeOpacity={0.8}
                    style={[styles.brandStyleChip, brandStyle === bs.id && styles.brandStyleChipActive]}
                  >
                    <Text style={[styles.brandStyleLabel, brandStyle === bs.id && styles.brandStyleLabelActive]}>{bs.label}</Text>
                    <Text style={styles.brandStyleDesc}>{bs.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditingBusiness(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="save-business-btn" onPress={saveBusiness} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ---- Social Accounts ---- */}
        <SectionHeader title="Social Accounts" />
        <View style={styles.card}>
          {(['instagram', 'facebook'] as const).map((platform, i) => {
            const account = socialAccounts[platform];
            const isConnected = !!account?.connected;
            const color = platform === 'instagram' ? Colors.instagram : Colors.facebook;
            const icon = platform === 'instagram' ? 'logo-instagram' : 'logo-facebook';
            return (
              <React.Fragment key={platform}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.settingsRow}>
                  <View style={[styles.rowIcon, { backgroundColor: color }]}>
                    <Ionicons name={icon as any} size={16} color={Colors.white} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                    {isConnected ? (
                      <Text style={[styles.rowSublabel, { color: Colors.success }]}>{account?.handle}</Text>
                    ) : (
                      <Text style={styles.rowSublabel}>Not connected</Text>
                    )}
                  </View>
                  {isConnected ? (
                    <TouchableOpacity
                      testID={`disconnect-${platform}-btn`}
                      onPress={() => handleDisconnect(platform)}
                      style={styles.disconnectBtn}
                    >
                      <Text style={styles.disconnectBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      testID={`connect-${platform}-btn`}
                      onPress={() => setConnectingPlatform(platform)}
                      style={styles.connectBtn}
                    >
                      <Text style={styles.connectBtnText}>Connect</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {connectingPlatform === platform && (
                  <View style={styles.connectForm}>
                    <TextInput
                      testID={`${platform}-handle-input`}
                      value={handleInput}
                      onChangeText={setHandleInput}
                      placeholder={`@your${platform}handle`}
                      placeholderTextColor={Colors.textTertiary}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                    <View style={styles.connectFormBtns}>
                      <TouchableOpacity onPress={() => { setConnectingPlatform(null); setHandleInput(''); }} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`confirm-connect-${platform}-btn`}
                        onPress={() => handleConnect(platform)}
                        style={styles.saveBtn}
                      >
                        <Text style={styles.saveBtnText}>Connect</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ---- Subscription ---- */}
        <SectionHeader title="Subscription" />
        <View style={styles.card}>
          <View style={styles.subStatusRow}>
            <View style={styles.subInfo}>
              <Text style={styles.subPlanName}>{subscription.planName}</Text>
              <StatusChip status={subscription.status} daysLeft={subscription.daysLeft} size="md" />
            </View>
            <View style={styles.subDetails}>
              {subscription.status === 'trial' && (
                <Text style={styles.subDetail}>
                  {subscription.daysLeft} days · {subscription.postsLeft} posts remaining
                </Text>
              )}
              {subscription.status === 'subscribed' && (
                <Text style={[styles.subDetail, { color: Colors.success }]}>Active subscription</Text>
              )}
              <Text style={styles.fairUse}>Fair use applies</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {subscription.status !== 'subscribed' ? (
            <View style={styles.subActions}>
              <PrimaryButton
                testID="upgrade-subscription-btn"
                title={`Start subscription — ${subscription.price}`}
                onPress={handleStartSubscription}
              />
              <TouchableOpacity
                onPress={handleRestore}
                style={[styles.secondaryBtn, { marginTop: 8 }]}
              >
                <Text style={styles.secondaryText}>Restore purchases</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="card-outline"
              iconBg={Colors.success}
              label="Manage Subscription"
              onPress={() => showToast('Subscription management coming soon', 'info')}
            />
          )}
        </View>

        {/* ---- App Info ---- */}
        <SectionHeader title="App Info" />
        <View style={styles.card}>
          <SettingsRow
            icon="help-circle-outline"
            iconBg="#64748b"
            label="Help & Support"
            onPress={() => showToast('Support: hello@quickpost.app', 'info')}
            testID="settings-help-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg="#64748b"
            label="Privacy Policy"
            onPress={() => openLegalUrl(process.env.EXPO_PUBLIC_PRIVACY_URL, 'Privacy Policy')}
            testID="settings-privacy-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text-outline"
            iconBg="#64748b"
            label="Terms of Service"
            onPress={() => openLegalUrl(process.env.EXPO_PUBLIC_TERMS_URL, 'Terms of Service')}
            testID="settings-terms-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            iconBg="#64748b"
            label="Data Deletion"
            sublabel="How to delete your account and data"
            onPress={() => openLegalUrl(process.env.EXPO_PUBLIC_DATA_DELETION_URL, 'Data Deletion')}
            testID="settings-data-deletion-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="information-circle-outline"
            iconBg="#64748b"
            label="App Version"
            sublabel="Quickpost v1.0.0"
            testID="settings-version-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="log-out-outline"
            iconBg="#ef4444"
            label="Log Out"
            onPress={handleLogout}
            testID="settings-logout-row"
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  sectionHeader: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm, marginTop: Spacing.lg, ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { marginHorizontal: Spacing.base, backgroundColor: Colors.paper, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 56 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  rowSublabel: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  editForm: { padding: 16 },
  editFormTitle: { ...Typography.h4, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: Colors.subtle, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.subtle },
  typeChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: Colors.primary },
  brandStyleRow: { flexDirection: 'row', gap: 8 },
  brandStyleChip: { flex: 1, padding: 10, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.subtle },
  brandStyleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  brandStyleLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 2 },
  brandStyleLabelActive: { color: Colors.primary },
  brandStyleDesc: { fontSize: 11, color: Colors.textTertiary },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  connectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight },
  connectBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  disconnectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: Colors.errorLight },
  disconnectBtnText: { fontSize: 12, fontWeight: '600', color: Colors.error },
  connectForm: { paddingHorizontal: 14, paddingBottom: 14 },
  connectFormBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  subStatusRow: { padding: 16 },
  subInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subPlanName: { ...Typography.h4, fontWeight: '700' },
  subDetails: { gap: 4 },
  subDetail: { fontSize: 13, color: Colors.textSecondary },
  fairUse: { fontSize: 11, color: Colors.textTertiary, fontStyle: 'italic' },
  subActions: { padding: 14 },
  secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
});
