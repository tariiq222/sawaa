import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { fontAssets } from '@/theme/fonts';

// Localized screens own row order and physical text alignment. Keep the native
// layout basis stable rather than applying RTL twice on Arabic devices.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
void SplashScreen.preventAutoHideAsync();

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
    <SafeAreaProvider style={{ flex: 1, direction: 'ltr' }}>
      <Slot />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { language, ready } = useLanguagePreference();

  useEffect(() => {
    if (fontError) throw fontError;
    if (fontsLoaded && ready) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, ready]);

  if (!ready || !fontsLoaded) return null;

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
