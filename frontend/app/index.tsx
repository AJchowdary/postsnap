import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { loadToken, authMe, bootstrapAccount } from '../src/services/api';
import { Colors } from '../src/constants/theme';

export default function Index() {
  const userId = useAppStore((s) => s.userId);
  const isOnboarded = useAppStore((s) => s.isOnboarded);
  const setAuth = useAppStore((s) => s.setAuth);
  const setBusinessProfile = useAppStore((s) => s.setBusinessProfile);
  const setIsOnboarded = useAppStore((s) => s.setIsOnboarded);
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

        if (account?.name) {
          setBusinessProfile({
            name: account.name,
            type: account.type || 'restaurant',
            city: account.city,
            brandStyle: account.brandStyle || 'clean',
            useLogoOverlay: account.useLogoOverlay || false,
          });
          setIsOnboarded(true);
          setRoute('/(tabs)/create');
        } else {
          setRoute('/onboarding');
        }
      } catch {
        setRoute('/welcome');
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return <Redirect href={(route as any) || '/auth'} />;
}
