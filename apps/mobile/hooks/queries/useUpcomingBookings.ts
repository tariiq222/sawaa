import { useQuery } from '@tanstack/react-query';

import {
  clientBookingsService,
  type BookingsListResponse,
} from '@/services/client';

import { clientBookingsKeys } from './useClientBookings';

/**
 * Upcoming bookings — first page, server-filtered when a status param exists.
 * The mobile backend currently exposes a single `list` endpoint; consumers
 * filter client-side, but this hook centralises the fetch + caching.
 */
export function useUpcomingBookings(limit = 50) {
  return useQuery<BookingsListResponse>({
    queryKey: clientBookingsKeys.list({ limit, page: 1 }),
    queryFn: () => clientBookingsService.list({ limit, page: 1 }),
  });
}
