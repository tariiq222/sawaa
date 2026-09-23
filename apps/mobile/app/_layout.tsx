import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Slot } from 'expo-router';

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
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { DirContext, buildDirState } from '@/hooks/useDir';
import { useLanguagePreference } from '@/hooks/language-preference';
import { ErrorBoundary } from '@/components/error-boundary';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { usePushResponses } from '@/hooks/use-push-responses';
import { usePushPreference } from '@/hooks/queries/usePushPreference';
import '@/i18n';

function PushBootstrap() {
  const { clientId, query } = usePushPreference();
  usePushNotifications(clientId, query.data?.enabled === true);
  usePushResponses(clientId);
  return null;
}

function RootContent() {
  const { scheme } = useTheme();

  return (
    <SafeAreaProvider>
      <Slot />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
    }
  }, []);

  const { language, ready } = useLanguagePreference();

  if (!ready) return null;

  const dirState = buildDirState(language);

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <PushBootstrap />
            <DirContext.Provider value={dirState}>
              <ThemeProvider language={language}>
                <RootContent />
              </ThemeProvider>
            </DirContext.Provider>
          </ErrorBoundary>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}

export default Sentry.wrap(RootLayout);
