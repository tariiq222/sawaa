import { useQuery } from '@tanstack/react-query';

import {
  clientPortalService,
  type PortalHomeResponse,
  type PortalSummary,
} from '@/services/client/portal';

const FIVE_MINUTES = 5 * 60 * 1000;

export const portalKeys = {
  all: ['portal'] as const,
  home: () => [...portalKeys.all, 'home'] as const,
  summary: () => [...portalKeys.all, 'summary'] as const,
  upcoming: (page: number, limit: number) =>
    [...portalKeys.all, 'upcoming', { page, limit }] as const,
};

export function useHome() {
  return useQuery<PortalHomeResponse>({
    queryKey: portalKeys.home(),
    queryFn: () => clientPortalService.getHome(),
    staleTime: FIVE_MINUTES,
  });
}

export function useSummary() {
  return useQuery<PortalSummary>({
    queryKey: portalKeys.summary(),
    queryFn: () => clientPortalService.getSummary(),
    staleTime: FIVE_MINUTES,
  });
}

export function useUpcoming(page = 1, limit = 10) {
  return useQuery({
    queryKey: portalKeys.upcoming(page, limit),
    queryFn: () => clientPortalService.getUpcoming(page, limit),
    staleTime: FIVE_MINUTES,
  });
}
