import { useQuery } from '@tanstack/react-query';

import {
  clientBookingsService,
  type ClientBookingRow,
} from '@/services/client';

import { clientBookingsKeys } from './useClientBookings';

export function useBooking(id: string | undefined) {
  return useQuery<ClientBookingRow>({
    queryKey: id ? clientBookingsKeys.detail(id) : clientBookingsKeys.detail('__none__'),
    queryFn: () => clientBookingsService.getById(id as string),
    enabled: Boolean(id),
  });
}
