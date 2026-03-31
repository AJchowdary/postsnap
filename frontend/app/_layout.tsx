import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

WebBrowser.maybeCompleteAuthSession();
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/appStore';
import Toast from '../src/components/Toast';

function GlobalToast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);
  if (!toast) return null;
  return <Toast toast={toast} onHide={hideToast} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/*
          File-based routes under app/ register automatically. Single screenOptions
          keeps headers off for index, auth, (tabs), post-preview, templates, etc.
        */}
        <Stack screenOptions={{ headerShown: false }} />
        <GlobalToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
