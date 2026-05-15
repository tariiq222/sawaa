import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { publicFetch, PublicFetchError } from '@/lib/public-fetch';

export function usePublicQuery<T>(
  queryKey: (string | number | undefined)[],
  path: string,
  options?: Omit<UseQueryOptions<T, PublicFetchError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, PublicFetchError>({
    queryKey,
    queryFn: () => publicFetch<T>(path),
    ...options,
  });
}

export function usePublicMutation<T, V = unknown>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST') {
  return useMutation<T, PublicFetchError, V>({
    mutationFn: (variables) =>
      publicFetch<T>(path, {
        method,
        body: JSON.stringify(variables),
      }),
  });
}
