import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { getPrimaryRole } from '@/types/auth';

export default function IndexScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    async function hydrate() {
      // If Redux already has tokens, skip hydration
      if (token && user) {
        setHydrating(false);
        return;
      }

      // Try to restore from SecureStore
      const stored = await authService.getStoredTokens();
      if (stored.accessToken) {
        try {
          const profileRes = await authService.getProfile();
          if (profileRes.success && profileRes.data) {
            dispatch(
              setCredentials({
                accessToken: stored.accessToken,
                refreshToken: stored.refreshToken ?? '',
                user: profileRes.data,
              }),
            );
          }
        } catch {
          // Token expired or invalid — go to login
        }
      }
      setHydrating(false);
    }

    hydrate();
  }, []);

  useEffect(() => {
    if (hydrating) return;

    if (!token || !user) {
      router.replace('/(auth)/login');
      return;
    }

    const role = getPrimaryRole(user);
    if (role === 'employee') {
      router.replace('/(employee)/(tabs)/today');
    } else {
      router.replace('/(client)/(tabs)/home');
    }
  }, [hydrating, token, user, router]);

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FB' }}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  return null;
}
