import { useQuery } from '@tanstack/react-query';
import { getMobileHomeCards } from '@/services/mobile-home-cards';

export const mobileHomeCardsQueryKey = ['mobile-home-cards'] as const;

export function useMobileHomeCards() {
  return useQuery({
    queryKey: mobileHomeCardsQueryKey,
    queryFn: getMobileHomeCards,
    staleTime: 60 * 1000,
    meta: { silentError: true },
  });
}
