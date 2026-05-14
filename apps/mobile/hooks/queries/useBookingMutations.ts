import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  clientBookingsService,
  type ClientBookingRow,
} from '@/services/client';

import { clientBookingsKeys } from './useClientBookings';

interface CancelVars {
  id: string;
  reason: string;
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation<ClientBookingRow, Error, CancelVars>({
    mutationFn: ({ id, reason }) => clientBookingsService.cancel(id, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: clientBookingsKeys.all });
      qc.invalidateQueries({ queryKey: clientBookingsKeys.detail(vars.id) });
    },
  });
}

interface RateVars {
  id: string;
  score: number;
  comment?: string;
  isPublic?: boolean;
}

export function useRateBooking() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, RateVars>({
    mutationFn: ({ id, score, comment, isPublic }) =>
      clientBookingsService.rate(id, { score, comment, isPublic }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: clientBookingsKeys.detail(vars.id) });
    },
  });
}
