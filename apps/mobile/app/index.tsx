import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import {
  getSessionEpoch,
  isLogoutFenceActive,
  isSessionCurrent,
} from '@/services/native-session-state';
import { getPrimaryRole } from '@/types/auth';

export default function IndexScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;
    const hydrationEpoch = getSessionEpoch();

    const finishInvalidatedBootstrap = () => {
      // A logout fence is terminal for this bootstrap attempt. A newer login
      // clears that fence; leave hydration pending so it cannot redirect over
      // the in-flight login before Redux receives its credentials.
      if (mounted && isLogoutFenceActive()) setHydrating(false);
    };

    async function hydrate() {
      // If Redux already has tokens, skip hydration
      if (token && user) {
        if (mounted && isSessionCurrent(hydrationEpoch)) setHydrating(false);
        return;
      }

      // Try to restore from SecureStore
      try {
        const stored = await authService.getStoredTokens();
        if (!mounted || !isSessionCurrent(hydrationEpoch)) {
          finishInvalidatedBootstrap();
          return;
        }
        if (stored.accessToken) {
          const profileRes = await authService.getProfile();
          if (!mounted || !isSessionCurrent(hydrationEpoch)) {
            finishInvalidatedBootstrap();
            return;
          }
          if (profileRes.success && profileRes.data) {
            // The profile request may have refreshed the access token. Use
            // the current pair, never the pre-refresh bootstrap snapshot.
            const fresh = await authService.getStoredTokens();
            if (!mounted || !isSessionCurrent(hydrationEpoch)) {
              finishInvalidatedBootstrap();
              return;
            }
            if (!fresh.accessToken) {
              setHydrating(false);
              return;
            }
            dispatch(
              setCredentials({
                accessToken: fresh.accessToken,
                refreshToken: fresh.refreshToken ?? '',
                user: profileRes.data,
              }),
            );
          }
        }
        if (mounted && isSessionCurrent(hydrationEpoch)) setHydrating(false);
      } catch {
        // Token expired or invalid — the interceptor may have fenced the
        // session. Finish that terminal path without publishing stale state.
        if (mounted && isSessionCurrent(hydrationEpoch)) setHydrating(false);
        else finishInvalidatedBootstrap();
      }
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [dispatch, token, user]);

  useEffect(() => {
    if (hydrating) return;

    if (!token || !user) {
      router.replace('/(auth)/login');
      return;
    }

    const role = getPrimaryRole(user);
    if (role !== 'client') {
      router.replace('/(employee)/(tabs)/today');
    } else {
      router.replace('/(client)/(tabs)/home');
    }
  }, [hydrating, token, user, router]);

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return null;
}
