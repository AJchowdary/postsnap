import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/appStore';
import Toast from '../src/components/Toast';
import { setOnSessionExpiredCallback } from '../src/services/api';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 }}>
            {this.state.message}
          </Text>
          <Text
            style={{ fontSize: 14, color: '#4f46e5', fontWeight: '600' }}
            onPress={() => this.setState({ hasError: false, message: '' })}
          >
            Try again
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function IAPConnectionManager() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { initConnection, endConnection } = await import('react-native-iap');
        await initConnection();
        cleanup = () => {
          endConnection().catch(() => {});
        };
      } catch {
        // react-native-iap not available in Expo Go / web — safe to ignore
      }
    })();
    return () => cleanup?.();
  }, []);
  return null;
}

function GlobalToast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);
  if (!toast) return null;
  return <Toast toast={toast} onHide={hideToast} />;
}

function SessionExpiredHandler() {
  const router = useRouter();
  const clearAuth = useAppStore((s) => s.clearAuth);
  useEffect(() => {
    setOnSessionExpiredCallback(() => {
      void clearAuth();
      router.replace('/auth?mode=login' as any);
    });
    return () => setOnSessionExpiredCallback(() => {});
  }, [router, clearAuth]);
  return null;
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <IAPConnectionManager />
          <SessionExpiredHandler />
          {/*
            File-based routes under app/ register automatically. Single screenOptions
            keeps headers off for index, auth, (tabs), post-preview, templates, etc.
          */}
          <Stack screenOptions={{ headerShown: false }} />
          <GlobalToast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
