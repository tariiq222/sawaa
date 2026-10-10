import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { Alert } from 'react-native';
import i18n from '@/i18n';

type ErrorKind = 'load' | 'request';

/**
 * Global error alert copy. Server and Axios messages are English and technical,
 * so they are never shown; screens needing a specific message set their own onError.
 */
function errorAlert(error: unknown, kind: ErrorKind): [title: string, message: string] {
  const err = error as { isAxiosError?: boolean; response?: unknown } | null;
  if (err?.isAxiosError && !err.response) {
    return [i18n.t('common.offlineTitle'), i18n.t('common.offlineDescription')];
  }
  return [i18n.t('common.error'), i18n.t(kind === 'load' ? 'common.errorDescription' : 'common.requestFailed')];
}

function isSilent(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  // Requests cancelled on purpose (for example after a session change) are not failures.
  if ((error as { code?: string }).code === 'ERR_CANCELED') return true;
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
    onError: (error, query) => {
      if (query.meta?.silentError === true) return;
      if (isSilent(error)) return;
      Alert.alert(...errorAlert(error, 'load'));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isSilent(error)) return;
      if (mutation.options.onError) return;
      Alert.alert(...errorAlert(error, 'request'));
    },
  }),
});
