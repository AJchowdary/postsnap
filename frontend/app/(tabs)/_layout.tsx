import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import Toast from '../../src/components/Toast';
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
        colors={['#f43f5e', '#f97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.createBtn}
      >
        <Ionicons name="add" size={22} color={Colors.white} />
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.createBtn, { backgroundColor: 'rgba(244,63,94,0.18)' }]}>
      <Ionicons name="add" size={22} color={Colors.primary} />
    </View>
  );
}

export default function TabLayout() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);
  const showPaywall = useAppStore((s) => s.showPaywall);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const showToast = useAppStore((s) => s.showToast);
  const insets = useSafeAreaInsets();

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
          tabBarStyle: {
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: '#13131c',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.08)',
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: '#71717a',
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ focused }) => <CreateTabIcon focused={focused} />,
            tabBarLabelStyle: [styles.tabLabel, { color: Colors.primary, fontWeight: '700' }],
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
      </Tabs>

      {toast && <Toast toast={toast} onHide={hideToast} />}
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
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  createBtnActive: {
    backgroundColor: '#4338ca',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
