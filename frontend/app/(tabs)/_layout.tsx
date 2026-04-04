import React, { useMemo } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Colors, GradientColors } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import PaywallModal from '../../src/components/PaywallModal';
import {
  purchaseSubscription,
  restorePurchases,
  refreshSubscriptionFromBackend,
} from '../../src/services/iapService';

function CreateTabIcon({ focused }: { focused: boolean }) {
  if (focused) {
    return (
      <LinearGradient
        colors={GradientColors.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.createBtn}
      >
        <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.createBtn, styles.createBtnIdle]}>
      <Ionicons name="add" size={22} color={Colors.primary} />
    </View>
  );
}

export default function TabLayout() {
  const segments = useSegments();
  const showPaywall = useAppStore((s) => s.showPaywall);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const showToast = useAppStore((s) => s.showToast);
  const insets = useSafeAreaInsets();

  const hideTabBarOnCreate = segments[segments.length - 1] === 'create';

  const tabBarStyle = useMemo(() => {
    if (hideTabBarOnCreate) {
      return {
        display: 'none' as const,
        height: 0,
        marginBottom: 0,
        marginHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
        borderWidth: 0,
        opacity: 0,
      };
    }
    return {
      height: 68 + insets.bottom,
      paddingBottom: insets.bottom,
      paddingTop: 10,
      marginHorizontal: 14,
      marginBottom: 10,
      borderRadius: BorderRadius.card,
      backgroundColor: Colors.paper,
      borderTopWidth: 0,
      position: 'absolute' as const,
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: 'rgba(108, 99, 255, 0.12)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 6,
    };
  }, [hideTabBarOnCreate, insets.bottom]);

  const onUpgrade = async () => {
    const result = await purchaseSubscription(() => refreshSubscriptionFromBackend(setSubscription));
    if (result.success) {
      setShowPaywall(false);
      showToast('Subscription activated!', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const onRestore = async () => {
    const result = await restorePurchases(() => refreshSubscriptionFromBackend(setSubscription));
    if (result.success) {
      setShowPaywall(false);
      showToast('Purchases restored', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="campaigns"
          options={{
            title: 'Campaigns',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="megaphone-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ focused }) => <CreateTabIcon focused={focused} />,
            tabBarLabelStyle: [styles.tabLabel, { color: Colors.primary, fontWeight: '700' }],
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            href: null,
            title: 'History',
          }}
        />
        <Tabs.Screen
          name="drafts"
          options={{
            href: null,
            title: 'Drafts',
          }}
        />
      </Tabs>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={onUpgrade}
        onRestore={onRestore}
      />
    </>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    width: 44,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  createBtnIdle: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  createBtnActive: {
    backgroundColor: Colors.primaryDark,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
