import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Slot, useRouter } from 'expo-router';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enableAutoSessionTracking: true,
});
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';

import { store, persistor } from '@/stores/store';
import { queryClient } from '@/services/query-client';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DirContext, buildDirState } from '@/hooks/useDir';
import { loadCurrentOrgId } from '@/services/tenant';
import { useAppSelector } from '@/hooks/use-redux';
import { registerForPushAsync } from '@/services/push';
import '@/i18n';

function PushBootstrap() {
  const token = useAppSelector((s) => s.auth.token);
  useEffect(() => {
    if (!token) return;
    void registerForPushAsync();
  }, [token]);
  return null;
}

function AuthRouter() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const activeMembership = useAppSelector((s) => s.auth.activeMembership);

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
      return;
    }
    if (activeMembership) {
      router.replace('/(employee)/(tabs)/today');
      return;
    }
    router.replace('/(client)/(tabs)/home');
  }, [token, activeMembership, router]);

  return null;
}

function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
    }
    void loadCurrentOrgId();
  }, []);

  const dirState = buildDirState('ar');

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <PushBootstrap />
          <AuthRouter />
          <DirContext.Provider value={dirState}>
            <ThemeProvider language="ar">
              <SafeAreaProvider>
                <Slot />
                <StatusBar style="dark" />
              </SafeAreaProvider>
            </ThemeProvider>
          </DirContext.Provider>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}

export default Sentry.wrap(RootLayout);
