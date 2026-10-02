import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { fontAssets } from '@/theme/fonts';
import { BrandLaunch } from '@/components/BrandLaunch';
import { useStackDirectionOptions } from '@/hooks/useStackDirectionOptions';

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
  const stackDirection = useStackDirectionOptions();

  return (
    <SafeAreaProvider style={{ flex: 1, direction: 'ltr' }}>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: true, ...stackDirection }} />
      <BrandLaunch />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { language, ready } = useLanguagePreference();

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (!fontsLoaded || !ready) return;
    // BrandLaunch normally hides native splash immediately. If its subtree
    // fails before mounting, reveal the ErrorBoundary fallback instead of
    // leaving the native splash over a retry action indefinitely.
    const fallback = setTimeout(() => { void SplashScreen.hideAsync(); }, 3000);
    return () => clearTimeout(fallback);
  }, [fontsLoaded, ready]);

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
