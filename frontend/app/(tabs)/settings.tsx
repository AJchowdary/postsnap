import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, Linking, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import { BrandStyle, Platform as SocialPlatform, BrandVibe } from '../../src/types';
import StatusChip from '../../src/components/StatusChip';
import PrimaryButton from '../../src/components/PrimaryButton';
import { BusinessTypeSelector, BusinessTypeSelection } from '../../src/components/BusinessTypeSelector';
import {
  disconnectSocialAccount,
  updateBusinessProfile,
  fetchSocialConnections,
  mapConnectionsToSocialAccounts,
  getMetaOAuthLoginUrl,
  getMetaOAuthRedirectUrlForBrowser,
  scanWebsite,
  getMyAccount,
  setPushNotificationsEnabledApi,
  savePushToken,
  fetchDraftsFromBackend,
  DRAFT_LIMIT,
  deleteAccountApi,
} from '../../src/services/api';
import { registerForPushNotifications } from '../../src/services/notifications';
import BrandColorPicker from '../../src/components/BrandColorPicker';
import BrandVibePicker from '../../src/components/BrandVibePicker';
import { purchaseSubscription, restorePurchases, refreshSubscriptionFromBackend } from '../../src/services/iapService';

const BRAND_STYLES: { id: BrandStyle; label: string; desc: string }[] = [
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
  const setSocialAccounts = useAppStore((s) => s.setSocialAccounts);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const showToast = useAppStore((s) => s.showToast);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const userEmail = useAppStore((s) => s.userEmail);

  const [editingBusiness, setEditingBusiness] = useState(false);
  const [bizName, setBizName] = useState(businessProfile.name);
  const [bizCity, setBizCity] = useState(businessProfile.city || '');
  const [bizSelection, setBizSelection] = useState<BusinessTypeSelection>({
    type: businessProfile.type,
    displayType: businessProfile.displayType,
    customDescription: businessProfile.customDescription,
  });
  const [brandStyle, setBrandStyle] = useState<BrandStyle>(businessProfile.brandStyle);
  const [useLogoOverlay, setUseLogoOverlay] = useState(businessProfile.useLogoOverlay);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<SocialPlatform | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  const [brandColorDraft, setBrandColorDraft] = useState(businessProfile.brandColor || Colors.accent);
  const [brandVibeDraft, setBrandVibeDraft] = useState<BrandVibe | undefined>(businessProfile.brandVibe);
  const [websiteUrlDraft, setWebsiteUrlDraft] = useState(businessProfile.websiteUrl || '');
  const [websiteSummaryDraft, setWebsiteSummaryDraft] = useState(businessProfile.websiteSummary || '');
  const [igDraft, setIgDraft] = useState(businessProfile.instagramHandle || '');
  const [fbDraft, setFbDraft] = useState(businessProfile.facebookPage || '');
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [vibeModalOpen, setVibeModalOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ count: number; limit: number }>({
    count: 0,
    limit: DRAFT_LIMIT,
  });

  useEffect(() => {
    setBrandColorDraft(businessProfile.brandColor || Colors.accent);
    setBrandVibeDraft(businessProfile.brandVibe);
    setWebsiteUrlDraft(businessProfile.websiteUrl || '');
    setWebsiteSummaryDraft(businessProfile.websiteSummary || '');
    setIgDraft(businessProfile.instagramHandle || '');
    setFbDraft(businessProfile.facebookPage || '');
  }, [businessProfile]);

  useEffect(() => {
    if (!editingBusiness) return;
    setBizName(businessProfile.name);
    setBizCity(businessProfile.city || '');
    setBizSelection({
      type: businessProfile.type,
      displayType: businessProfile.displayType,
      customDescription: businessProfile.customDescription,
    });
    setBrandStyle(businessProfile.brandStyle);
    setUseLogoOverlay(businessProfile.useLogoOverlay);
  }, [editingBusiness, businessProfile]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const data = await fetchSocialConnections();
          if (cancelled) return;
          try {
            setSocialAccounts(mapConnectionsToSocialAccounts(data));
          } catch (mapErr) {
            if (__DEV__) console.warn('[settings] mapConnectionsToSocialAccounts failed', mapErr);
          }
        } catch (err) {
          if (__DEV__) console.warn('[settings] fetchSocialConnections failed', err);
          // Keep existing store; screen must still render (offline / API errors).
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [setSocialAccounts])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const acc = await getMyAccount();
          if (cancelled || !acc || typeof acc.pushNotificationsEnabled !== 'boolean') return;
          setBusinessProfile({ pushNotificationsEnabled: acc.pushNotificationsEnabled });
        } catch {
          /* offline */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [setBusinessProfile])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchDraftsFromBackend().then((d) => {
        if (!cancelled) setDraftMeta({ count: d.count, limit: d.limit });
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const saveBusiness = async () => {
    if (!bizName.trim()) { showToast('Business name is required', 'error'); return; }
    const profile = {
      name: bizName.trim(),
      city: bizCity.trim() || undefined,
      type: bizSelection.type,
      displayType: bizSelection.displayType,
      customDescription: bizSelection.customDescription,
      brandStyle,
      useLogoOverlay,
    };
    setBusinessProfile(profile);
    setEditingBusiness(false);
    try {
      await updateBusinessProfile(profile);
      showToast('Business info updated', 'success');
    } catch {
      showToast('Saved locally (offline)', 'info');
    }
  };

  const saveBrandDna = async () => {
    const profile = {
      name: businessProfile.name,
      type: businessProfile.type,
      displayType: businessProfile.displayType,
      customDescription: businessProfile.customDescription,
      city: bizCity.trim() || undefined,
      brandStyle: businessProfile.brandStyle,
      useLogoOverlay: businessProfile.useLogoOverlay,
      brandColor: brandColorDraft,
      brandVibe: brandVibeDraft,
      dominantColors: [brandColorDraft],
      websiteUrl: websiteUrlDraft.trim() || undefined,
      websiteSummary: websiteSummaryDraft.trim() || undefined,
      instagramHandle: igDraft.trim() || undefined,
      facebookPage: fbDraft.trim() || undefined,
      brandDnaSource: businessProfile.brandDnaSource ?? 'manual',
    };
    setBusinessProfile(profile);
    try {
      await updateBusinessProfile(profile);
      showToast('Brand profile saved', 'success');
    } catch {
      showToast('Saved locally (offline)', 'info');
    }
  };

  const handleRescanWebsite = async () => {
    if (!websiteUrlDraft.trim()) {
      showToast('Add a website URL first', 'error');
      return;
    }
    setScanBusy(true);
    try {
      const { account } = await scanWebsite(websiteUrlDraft.trim());
      const a = account as Record<string, any>;
      setBusinessProfile({
        name: a.name || businessProfile.name,
        type: a.type,
        displayType: a.displayType,
        customDescription: a.customDescription ?? '',
        city: a.city,
        brandColor: a.brandColor,
        brandVibe: a.brandVibe,
        dominantColors: a.dominantColors ?? [],
        websiteUrl: a.websiteUrl,
        websiteSummary: a.websiteSummary,
        toneExample: a.toneExample,
        instagramHandle: a.instagramHandle,
        brandDnaSource: 'website',
        brandStyle: businessProfile.brandStyle,
        useLogoOverlay: businessProfile.useLogoOverlay,
      });
      showToast('Website rescanned', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Scan failed', 'error');
    } finally {
      setScanBusy(false);
    }
  };

  const handleOAuthConnect = async (platform: SocialPlatform) => {
    if (oauthBusyPlatform) return;
    setOauthBusyPlatform(platform);
    try {
      const { url } = await getMetaOAuthLoginUrl(platform);
      const redirectUrl = getMetaOAuthRedirectUrlForBrowser();
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === 'success') {
        const data = await fetchSocialConnections();
        setSocialAccounts(mapConnectionsToSocialAccounts(data));
        showToast(
          platform === 'instagram' ? 'Instagram connected' : 'Facebook connected',
          'success'
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not connect';
      showToast(msg, 'error');
    } finally {
      setOauthBusyPlatform(null);
    }
  };

  const runDisconnect = async (platform: SocialPlatform) => {
    try {
      await disconnectSocialAccount(platform);
      const data = await fetchSocialConnections();
      setSocialAccounts(mapConnectionsToSocialAccounts(data));
      showToast(`${platform} disconnected`, 'info');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Disconnect failed';
      showToast(msg, 'error');
    }
  };

  const handleDisconnect = (platform: SocialPlatform) => {
    const go = () => {
      void runDisconnect(platform);
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Disconnect ${platform}?`)) go();
      return;
    }
    Alert.alert('Disconnect', `Disconnect ${platform}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: go },
    ]);
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

  const pushEnabled = businessProfile.pushNotificationsEnabled !== false;

  const handlePushToggle = async (enabled: boolean) => {
    const prev = businessProfile.pushNotificationsEnabled !== false;
    setBusinessProfile({ pushNotificationsEnabled: enabled });
    try {
      const { account } = await setPushNotificationsEnabledApi(enabled);
      const a = account as { pushNotificationsEnabled?: boolean };
      if (typeof a.pushNotificationsEnabled === 'boolean') {
        setBusinessProfile({ pushNotificationsEnabled: a.pushNotificationsEnabled });
      }
      if (enabled) {
        const token = await registerForPushNotifications();
        if (token) await savePushToken(token);
      }
    } catch {
      setBusinessProfile({ pushNotificationsEnabled: prev });
      showToast('Could not update push notifications', 'error');
    }
  };

  const performLogout = async () => {
    await clearAuth();
    router.replace('/auth?mode=login');
  };

  const handleLogout = () => {
    // react-native-web's Alert.alert is a no-op; use window.confirm on web.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) {
        void performLogout();
      }
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    const performDelete = async () => {
      try {
        await deleteAccountApi();
        await clearAuth();
        router.replace('/auth?mode=login');
      } catch (e: any) {
        showToast(e?.message ?? 'Failed to delete account. Please try again.', 'error');
      }
    };

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(
          'Delete your account? This permanently removes all your data and cannot be undone.'
        )
      ) {
        void performDelete();
      }
      return;
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => void performDelete(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header + Profile */}
        <View style={styles.header}>
          <Text style={styles.title} testID="settings-title">Settings</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={26} color={Colors.background} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{businessProfile.name || 'Quickpost User'}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {userEmail || 'you@example.com'}
              </Text>
            </View>
            <StatusChip status={subscription.status} daysLeft={subscription.daysLeft} />
          </View>
        </View>

        <SectionHeader title="Your posts" />
        <View style={styles.card}>
          <SettingsRow
            testID="settings-post-history"
            icon="time-outline"
            iconBg={Colors.secondary}
            label="Post history"
            sublabel="Drafts, published, and past posts"
            onPress={() => router.push('/(tabs)/history')}
          />
          <View style={styles.divider} />
          <SettingsRow
            testID="settings-drafts"
            icon="document-text-outline"
            iconBg={Colors.primary}
            label="Drafts"
            sublabel={`${draftMeta.count} of ${draftMeta.limit} slots used`}
            onPress={() => router.push('/(tabs)/drafts')}
            rightEl={
              <View style={styles.draftRowRight}>
                {draftMeta.count > 0 ? (
                  <View style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>{draftMeta.count}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </View>
            }
          />
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <View style={styles.settingsRow}>
            <View style={[styles.rowIcon, { backgroundColor: Colors.accent }]}>
              <Ionicons name="notifications-outline" size={16} color={Colors.white} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Text style={styles.rowSublabel}>Alerts for publishing and Brand DNA</Text>
            </View>
            <Switch
              testID="push-notifications-switch"
              value={pushEnabled}
              onValueChange={(v) => void handlePushToggle(v)}
              trackColor={{ false: Colors.border, true: Colors.primaryMid }}
              thumbColor={pushEnabled ? Colors.primary : Colors.white}
            />
          </View>
        </View>

        {/* ---- Business Profile ---- */}
        <SectionHeader title="Business Profile" />
        <View style={styles.card}>
          {!editingBusiness ? (
            <>
              <SettingsRow
                icon="storefront-outline"
                iconBg={Colors.primary}
                label={businessProfile.name || 'Business Profile'}
                sublabel={`${businessProfile.displayType}${businessProfile.city ? ` · ${businessProfile.city}` : ''}`}
                onPress={() => setEditingBusiness(true)}
                testID="settings-business-row"
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="color-palette-outline"
                iconBg={Colors.primaryDark}
                label="Brand Style"
                sublabel={brandStyle.charAt(0).toUpperCase() + brandStyle.slice(1)}
                onPress={() => setEditingBusiness(true)}
              />
              <View style={styles.divider} />
              <View style={styles.settingsRow}>
                <View style={[styles.rowIcon, { backgroundColor: Colors.info }]}>
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

              <Text style={styles.inputLabel}>Business type</Text>
              <TouchableOpacity
                testID="settings-business-type-trigger"
                onPress={() => setTypeModalVisible(true)}
                activeOpacity={0.85}
                style={styles.typeTrigger}
              >
                <Text style={styles.typeTriggerText} numberOfLines={2}>{bizSelection.displayType}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {!!bizSelection.customDescription && (
                <Text style={styles.typeHint} numberOfLines={2}>{bizSelection.customDescription}</Text>
              )}
              <BusinessTypeSelector
                variant="modal"
                visible={typeModalVisible}
                onClose={() => setTypeModalVisible(false)}
                value={bizSelection}
                onChange={(v) => {
                  setBizSelection(v);
                  setTypeModalVisible(false);
                }}
              />

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

        {/* ---- Brand DNA ---- */}
        <SectionHeader title="Brand DNA" />
        <SettingsRow
          icon="sparkles"
          iconBg={Colors.primary}
          label="Brand DNA dashboard"
          sublabel="Logo, colors, tone, and reference images"
          onPress={() => router.push('/brand-dna')}
        />
        <View style={styles.card}>
          <Text style={styles.brandDnaHeader}>
            {businessProfile.brandDnaSource === 'website' && '🌐 Brand DNA — Built from your website'}
            {businessProfile.brandDnaSource === 'manual' && '✏️ Brand DNA — Set up manually'}
            {businessProfile.brandDnaSource === 'hybrid' && '✨ Brand DNA — Website + Manual'}
            {!businessProfile.brandDnaSource && 'Brand DNA'}
          </Text>
          {businessProfile.brandDnaSource === 'website' && !!businessProfile.websiteUrl && (
            <View style={styles.brandRowLine}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.brandRowText} numberOfLines={2}>{businessProfile.websiteUrl}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.brandTapRow} onPress={() => setColorModalOpen(true)}>
            <Text style={styles.brandTapLabel}>Brand color</Text>
            <View style={[styles.brandMiniSwatch, { backgroundColor: brandColorDraft }]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.brandTapRow} onPress={() => setVibeModalOpen(true)}>
            <Text style={styles.brandTapLabel}>Vibe</Text>
            <Text style={styles.brandTapValue}>{brandVibeDraft || 'warm'}</Text>
          </TouchableOpacity>
          {businessProfile.brandDnaSource === 'manual' && (
            <Text style={styles.brandLink}>Add your website above to enhance AI results →</Text>
          )}
          <Text style={styles.inputLabel}>Website URL</Text>
          <TextInput
            value={websiteUrlDraft}
            onChangeText={setWebsiteUrlDraft}
            placeholder="https://"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.inputLabel}>About (from scan or your notes)</Text>
          <TextInput
            value={websiteSummaryDraft}
            onChangeText={setWebsiteSummaryDraft}
            placeholder="Short summary for AI"
            placeholderTextColor={Colors.textTertiary}
            style={[styles.input, { minHeight: 72 }]}
            multiline
          />
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            value={bizCity}
            onChangeText={setBizCity}
            placeholder="Your city"
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
          />
          <Text style={styles.inputLabel}>Instagram</Text>
          <TextInput
            value={igDraft ? `@${igDraft.replace(/^@/, '')}` : ''}
            onChangeText={(t) => setIgDraft(t.replace(/^@/, ''))}
            placeholder="@handle"
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
          />
          <Text style={styles.inputLabel}>Facebook page</Text>
          <TextInput
            value={fbDraft}
            onChangeText={setFbDraft}
            placeholder="Page name or URL"
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
          />
          {businessProfile.brandDnaSource === 'website' && (
            <TouchableOpacity
              onPress={handleRescanWebsite}
              disabled={scanBusy}
              style={[styles.outlineBtn, scanBusy && { opacity: 0.6 }]}
            >
              {scanBusy ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.outlineBtnText}>Rescan Website</Text>
              )}
            </TouchableOpacity>
          )}
          <View style={styles.brandSaveWrap}>
            <PrimaryButton title="Save Brand Profile" onPress={saveBrandDna} />
          </View>
        </View>

        <Modal visible={colorModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Brand color</Text>
              <BrandColorPicker value={brandColorDraft} onChange={setBrandColorDraft} />
              <TouchableOpacity onPress={() => setColorModalOpen(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal visible={vibeModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Brand vibe</Text>
              <BrandVibePicker
                value={brandVibeDraft || 'warm'}
                onChange={(v) => setBrandVibeDraft(v)}
              />
              <TouchableOpacity onPress={() => setVibeModalOpen(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ---- Social Accounts ---- */}
        <SectionHeader title="Social Accounts" />
        <View style={styles.card}>
          {(['instagram', 'facebook'] as const).map((platform, i) => {
            const account = socialAccounts[platform];
            const isActive = !!account?.connected;
            const needsReconnect = !!account?.reconnectRequired;
            const color = platform === 'instagram' ? Colors.instagram : Colors.facebook;
            const icon = platform === 'instagram' ? 'logo-instagram' : 'logo-facebook';
            const displayLine =
              platform === 'facebook'
                ? (account?.pageName || account?.handle || '')
                : (account?.igUsername
                  ? `@${account.igUsername.replace(/^@/, '')}`
                  : account?.handle || '');
            const busy = oauthBusyPlatform === platform;
            return (
              <React.Fragment key={platform}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.settingsRow}>
                  <View style={[styles.rowIcon, { backgroundColor: color }]}>
                    <Ionicons name={icon as any} size={16} color={Colors.white} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                    {isActive ? (
                      <Text style={[styles.rowSublabel, { color: Colors.success }]} numberOfLines={2}>
                        {platform === 'facebook' ? (account?.pageName || account?.handle) : displayLine}
                      </Text>
                    ) : account && (needsReconnect || displayLine) ? (
                      <Text style={[styles.rowSublabel, { color: Colors.warning }]} numberOfLines={2}>
                        {displayLine ? `${displayLine} · ` : ''}Reconnect required
                      </Text>
                    ) : (
                      <Text style={styles.rowSublabel}>Not connected</Text>
                    )}
                  </View>
                  {isActive ? (
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
                      onPress={() => handleOAuthConnect(platform)}
                      disabled={busy || !!oauthBusyPlatform}
                      style={[styles.connectBtn, (busy || oauthBusyPlatform) && styles.connectBtnDisabled]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Text style={styles.connectBtnText}>{account ? 'Reconnect' : 'Connect'}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
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
              onPress={() => {
                const url =
                  Platform.OS === 'ios'
                    ? 'https://apps.apple.com/account/subscriptions'
                    : 'https://play.google.com/store/account/subscriptions';
                Linking.openURL(url);
              }}
            />
          )}
        </View>

        {/* ---- Support ---- */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingsRow
            icon="help-circle-outline"
            iconBg={Colors.textMuted}
            label="Help & Support"
            onPress={() => showToast('Support: hello@quickpost.app', 'info')}
            testID="settings-help-row"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconBg={Colors.textMuted}
            label="Send Feedback"
            onPress={() => Linking.openURL('mailto:hello@quickpost.app?subject=Quickpost%20Feedback')}
            testID="settings-feedback-row"
          />
        </View>

        <TouchableOpacity testID="settings-logout-row" onPress={handleLogout} style={styles.signOutBtn} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="settings-delete-account-row" onPress={handleDeleteAccount} style={styles.deleteAccountBtn} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  profileCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    padding: 14,
    ...Shadows.sm,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.h4, fontWeight: '800' },
  profileEmail: { ...Typography.bodySmall, marginTop: 2, color: Colors.textSecondary },
  sectionHeader: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm, marginTop: Spacing.lg, ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { marginHorizontal: Spacing.base, backgroundColor: Colors.surfaceContainer, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 56 },
  draftRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  rowSublabel: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  editForm: { padding: 16 },
  editFormTitle: { ...Typography.h4, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: Colors.subtle, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  typeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.subtle,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  typeTriggerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  typeHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, lineHeight: 15 },
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
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textOnPrimary },
  connectBtn: { minWidth: 88, paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  disconnectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: Colors.errorLight },
  disconnectBtnText: { fontSize: 12, fontWeight: '600', color: Colors.error },
  subStatusRow: { padding: 16 },
  subInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subPlanName: { ...Typography.h4, fontWeight: '700' },
  subDetails: { gap: 4 },
  subDetail: { fontSize: 13, color: Colors.textSecondary },
  fairUse: { fontSize: 11, color: Colors.textTertiary, fontStyle: 'italic' },
  subActions: { padding: 14 },
  secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  signOutBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.errorBorderMuted,
  },
  signOutText: { color: Colors.error, fontWeight: '800', fontSize: 15 },
  deleteAccountBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.errorBorderMuted,
  },
  deleteAccountText: { color: Colors.error, fontWeight: '600', fontSize: 14 },

  brandDnaHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  brandRowLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 8 },
  brandRowText: { flex: 1, fontSize: 12, color: Colors.success },
  brandTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  brandTapLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  brandTapValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  brandMiniSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.white },
  brandLink: { fontSize: 13, color: Colors.primary, fontWeight: '700', paddingHorizontal: 14, marginBottom: 10 },
  outlineBtn: {
    marginHorizontal: 14,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  outlineBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  brandSaveWrap: { padding: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay55,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  modalTitle: { ...Typography.h4, marginBottom: 8 },
  modalClose: { alignItems: 'center', paddingVertical: 12 },
  modalCloseText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
});
