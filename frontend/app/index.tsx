import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import {
  loadToken,
  authMe,
  bootstrapAccount,
  fetchSocialConnections,
  mapConnectionsToSocialAccounts,
  savePushToken,
} from '../src/services/api';
import { registerForPushNotifications } from '../src/services/notifications';
import { Colors } from '../src/constants/theme';
import { defaultDisplayForBusinessType } from '../src/constants/businessTypeCatalog';
import type { BusinessType } from '../src/types';
import LegalDisclosureModal from '../src/components/LegalDisclosureModal';
import { legalAcceptedStorageKey } from '../src/constants/legal';
import { welcomeStorySeenStorageKey } from '../src/constants/welcomeStory';
import { supabase, isSupabaseOAuthConfigured } from '../src/lib/supabase';

async function destinationAfterLegal(nextRoute: string): Promise<string> {
  if (nextRoute !== '/onboarding') return nextRoute;
  const seen = await AsyncStorage.getItem(welcomeStorySeenStorageKey());
  return seen ? '/onboarding' : '/welcome-story';
}

export default function Index() {
  const setAuth = useAppStore((s) => s.setAuth);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const showToast = useAppStore((s) => s.showToast);
  const setSocialAccounts = useAppStore((s) => s.setSocialAccounts);
  const [checking, setChecking] = useState(true);
  const [route, setRoute] = useState<string | null>(null);
  const [needsLegal, setNeedsLegal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (!token) {
          setRoute('/welcome');
          return;
        }

        const me = await authMe();
        if (!me?.userId) {
          setRoute('/welcome');
          return;
        }

        const account = await bootstrapAccount();
        await setAuth(me.userId, '', token);

        if (account?.pushNotificationsEnabled !== false) {
          try {
            const pushToken = await registerForPushNotifications();
            if (pushToken) await savePushToken(pushToken);
          } catch {
            /* offline or permission denied */
          }
        }

        try {
          const social = await fetchSocialConnections();
          setSocialAccounts(mapConnectionsToSocialAccounts(social));
        } catch {
          /* offline */
        }

        let nextRoute: string;
        if (account?.name) {
          const t = (account.type || 'restaurant') as BusinessType;
          setBusinessProfile({
            name: account.name,
            pushNotificationsEnabled: account.pushNotificationsEnabled !== false,
            type: t,
            displayType: account.displayType || defaultDisplayForBusinessType(t),
            customDescription: account.customDescription ?? '',
            city: account.city,
            logo: account.logo,
            brandStyle: account.brandStyle || 'clean',
            useLogoOverlay: account.useLogoOverlay || false,
            brandColor: account.brandColor,
            brandVibe: account.brandVibe,
            dominantColors: account.dominantColors ?? [],
            websiteUrl: account.websiteUrl,
            websiteSummary: account.websiteSummary,
            toneExample: account.toneExample,
            instagramHandle: account.instagramHandle,
            facebookPage: account.facebookPage,
            brandDnaSource: account.brandDnaSource ?? 'manual',
            businessSubcategory: account.businessSubcategory,
            neighborhood: account.neighborhood,
            tagline: account.tagline,
            toneOfVoice: account.toneOfVoice,
            contentPersona: account.contentPersona,
            coreServices: account.coreServices ?? [],
            heroProduct: account.heroProduct,
            pricePositioning: account.pricePositioning,
            uniqueDifferentiator: account.uniqueDifferentiator,
            visualStyle: account.visualStyle,
            photoStyleExamples: account.photoStyleExamples ?? [],
            studioStylePreference: account.studioStylePreference,
            studioBgColor: account.studioBgColor,
            seasonalContext: account.seasonalContext,
            localEvents: account.localEvents ?? [],
            lastPostTopics: account.lastPostTopics ?? [],
            topPerformingAngles: account.topPerformingAngles ?? [],
            preferredCaptionLength: account.preferredCaptionLength,
            preferredPostingDays: account.preferredPostingDays ?? [],
            photoStudioHistory: account.photoStudioHistory ?? [],
            confidenceOverall: account.confidenceOverall,
            enrichmentVersion: account.enrichmentVersion,
          });
          setIsOnboarded(true);
          nextRoute = '/(tabs)/create';
        } else {
          nextRoute = '/onboarding';
        }

        const legalKey = legalAcceptedStorageKey();
        const accepted = await AsyncStorage.getItem(legalKey);
        if (!accepted) {
          setPendingRoute(nextRoute);
          setNeedsLegal(true);
          return;
        }

        setRoute(await destinationAfterLegal(nextRoute));
      } catch {
        showToast('Could not reach server. Please check your connection.', 'error');
        setRoute('/welcome');
      } finally {
        setChecking(false);
      }
    })();
  }, [setAuth, setBusinessProfile, setIsOnboarded, showToast, setSocialAccounts]);

  const handleLegalAgree = async () => {
    await AsyncStorage.setItem(legalAcceptedStorageKey(), '1');
    setNeedsLegal(false);
    if (pendingRoute) {
      const dest = await destinationAfterLegal(pendingRoute);
      setRoute(dest);
    }
    setPendingRoute(null);
  };

  const handleLegalExit = async () => {
    await clearAuth();
    if (isSupabaseOAuthConfigured()) {
      await supabase.auth.signOut().catch(() => {});
    }
    setNeedsLegal(false);
    setPendingRoute(null);
    setRoute('/welcome');
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (needsLegal && pendingRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <LegalDisclosureModal visible onAgree={handleLegalAgree} onExit={handleLegalExit} />
      </View>
    );
  }

  return <Redirect href={(route as any) || '/auth'} />;
}
