import { useQuery } from '@tanstack/react-query';

import {
  clientBookingsService,
  type BookingsListResponse,
} from '@/services/client';

interface UseClientBookingsParams {
  status?: string;
  page?: number;
  limit?: number;
}

export const clientBookingsKeys = {
  all: ['bookings'] as const,
  lists: () => [...clientBookingsKeys.all, 'list'] as const,
  list: (params: UseClientBookingsParams) =>
    [...clientBookingsKeys.lists(), params] as const,
  details: () => [...clientBookingsKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientBookingsKeys.details(), id] as const,
};

export function useClientBookings(params: UseClientBookingsParams = {}) {
  return useQuery<BookingsListResponse>({
    queryKey: clientBookingsKeys.list(params),
    queryFn: () => clientBookingsService.list(params),
  });
}
