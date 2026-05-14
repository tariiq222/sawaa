import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicBranding } from '@deqah/shared';

import { publicBrandingService } from '@/services/client';
import { getSecureItem, setSecureItem } from '@/stores/secure-storage';

const CACHE_KEY = 'deqah.branding.cache.v1';

export const brandingKeys = {
  all: ['branding'] as const,
  public: () => [...brandingKeys.all, 'public'] as const,
};

async function readCache(): Promise<PublicBranding | null> {
  const raw = await getSecureItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicBranding;
  } catch {
    return null;
  }
}

async function writeCache(branding: PublicBranding): Promise<void> {
  await setSecureItem(CACHE_KEY, JSON.stringify(branding));
}

export function useBranding() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    void readCache().then((cached) => {
      if (cancelled || !cached) return;
      // Hydrate cache before first network response so the UI can render
      // with the last-known branding while the fresh fetch is in flight.
      queryClient.setQueryData(brandingKeys.public(), cached);
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const query = useQuery<PublicBranding>({
    queryKey: brandingKeys.public(),
    queryFn: async () => {
      const fresh = await publicBrandingService.get();
      void writeCache(fresh);
      return fresh;
    },
    staleTime: 10 * 60 * 1000,
  });

  return query;
}
