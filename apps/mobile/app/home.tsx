import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import HomeScreen from './(client)/(tabs)/home';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { authService } from '@/services/auth';
import {
  getSessionEpoch,
  isLogoutFenceActive,
  isSessionCurrent,
} from '@/services/native-session-state';
import { setCredentials } from '@/stores/slices/auth-slice';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

const HYDRATION_TIMEOUT_MS = 15_000;

/**
 * Public `/home` route.
 *
 * Serves as an alias:
 * - Guests render the public home screen with `GuestDock` and public catalog.
 * - Authenticated clients redirect to their tab shell `/(client)/(tabs)/home`.
 * - Authenticated staff redirect to their tab shell `/(employee)/(tabs)/today`.
 * - Pending session restoration displays a bounded loading indicator before
 *   determining the target shell.
 */
export default function HomeRoute() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const colors = useSawaaColors();
  const { token, user } = useAppSelector((state) => state.auth);

  // If token and user are already present in Redux, session is already complete.
  // If a logout fence is active, session is definitively cleared.
  const hasFullSession = Boolean(token && user);
  const isLoggedOut = isLogoutFenceActive();
  const [hydrating, setHydrating] = useState(() => !hasFullSession && !isLoggedOut);

  useEffect(() => {
    let mounted = true;
    let expired = false;
    let hydrationTimeout: ReturnType<typeof setTimeout> | undefined;
    const hydrationEpoch = getSessionEpoch();

    const finish = () => {
      if (hydrationTimeout !== undefined) clearTimeout(hydrationTimeout);
      if (mounted) setHydrating(false);
    };

    if (token && user) {
      finish();
      return;
    }

    if (isLogoutFenceActive()) {
      finish();
      return;
    }

    // Bound the entire storage/profile chain, including a pending token refresh.
    hydrationTimeout = setTimeout(() => {
      expired = true;
      finish();
    }, HYDRATION_TIMEOUT_MS);

    async function hydrate() {
      try {
        const stored = await authService.getStoredTokens();
        if (!mounted || expired || !isSessionCurrent(hydrationEpoch)) {
          finish();
          return;
        }

        const activeToken = token || stored.accessToken;
        if (!activeToken) {
          finish();
          return;
        }

        const profileRes = await authService.getProfile();
        if (!mounted || expired || !isSessionCurrent(hydrationEpoch)) {
          finish();
          return;
        }

        if (profileRes.success && profileRes.data) {
          const fresh = await authService.getStoredTokens();
          if (!mounted || expired || !isSessionCurrent(hydrationEpoch)) {
            finish();
            return;
          }
          const finalAccessToken = fresh.accessToken || activeToken;
          if (finalAccessToken) {
            dispatch(
              setCredentials({
                accessToken: finalAccessToken,
                refreshToken: fresh.refreshToken ?? '',
                user: profileRes.data,
              }),
            );
          }
        }
      } catch {
        // Expired or invalid token — settle as guest
      } finally {
        finish();
      }
    }

    void hydrate();
    return () => {
      mounted = false;
      if (hydrationTimeout !== undefined) clearTimeout(hydrationTimeout);
    };
  }, [dispatch, token, user]);

  useEffect(() => {
    if (hydrating) return;
    if (!token || !user) return;

    const role = getPrimaryRole(user);
    if (role !== 'client') {
      router.replace('/(employee)/(tabs)/today');
    } else {
      router.replace('/(client)/(tabs)/home');
    }
  }, [hydrating, token, user, router]);

  if (hydrating) {
    return (
      <AquaBackground>
        <View style={styles.center} testID="home-loading">
          <ActivityIndicator size="large" color={colors.teal[600]} />
        </View>
      </AquaBackground>
    );
  }

  // If authenticated, we are redirecting in useEffect; avoid rendering guest HomeScreen
  if (token && user) {
    return (
      <AquaBackground>
        <View style={styles.center} />
      </AquaBackground>
    );
  }

  return <HomeScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
