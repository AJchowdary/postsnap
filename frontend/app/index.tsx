import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import {
  loadToken,
  authMe,
  bootstrapAccount,
  fetchSocialConnections,
  mapConnectionsToSocialAccounts,
} from '../src/services/api';
import { Colors } from '../src/constants/theme';
import { defaultDisplayForBusinessType } from '../src/constants/businessTypeCatalog';
import type { BusinessType } from '../src/types';

export default function Index() {
  const setAuth = useAppStore((s) => s.setAuth);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
  const showToast = useAppStore((s) => s.showToast);
  const setSocialAccounts = useAppStore((s) => s.setSocialAccounts);
  const [checking, setChecking] = useState(true);
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (!token) { setRoute('/welcome'); return; }

        // Validate token + get userId
        const me = await authMe();
        if (!me?.userId) { setRoute('/welcome'); return; }

        // Bootstrap account and restore profile
        const account = await bootstrapAccount();
        await setAuth(me.userId, '', token);

        try {
          const social = await fetchSocialConnections();
          setSocialAccounts(mapConnectionsToSocialAccounts(social));
        } catch {
          // offline or misconfigured Meta — keep empty social state
        }

        if (account?.name) {
          const t = (account.type || 'restaurant') as BusinessType;
          setBusinessProfile({
            name: account.name,
            type: t,
            displayType: account.displayType || defaultDisplayForBusinessType(t),
            customDescription: account.customDescription ?? '',
            city: account.city,
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
          });
          setIsOnboarded(true);
          setRoute('/(tabs)/create');
        } else {
          setRoute('/onboarding');
        }
      } catch {
        showToast('Could not reach server. Please check your connection.', 'error');
        setRoute('/welcome');
      } finally {
        setChecking(false);
      }
    })();
  }, [setAuth, setBusinessProfile, setIsOnboarded, showToast, setSocialAccounts]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return <Redirect href={(route as any) || '/auth'} />;
}
