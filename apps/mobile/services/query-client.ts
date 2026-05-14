import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { Alert } from 'react-native';
import i18n from '@/i18n';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { message?: unknown } }; message?: unknown };
    const apiMessage = err.response?.data?.message;
    if (typeof apiMessage === 'string') return apiMessage;
    if (Array.isArray(apiMessage) && typeof apiMessage[0] === 'string') return apiMessage[0];
    if (typeof err.message === 'string') return err.message;
  }
  return i18n.t('common.error', 'حدث خطأ');
}

function isSilent(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { response?: { status?: number } }).response?.status;
  return status === 401 || status === 403;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isSilent(error)) return;
      Alert.alert(i18n.t('common.error', 'حدث خطأ'), extractMessage(error));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isSilent(error)) return;
      if (mutation.options.onError) return;
      Alert.alert(i18n.t('common.error', 'حدث خطأ'), extractMessage(error));
    },
  }),
});
