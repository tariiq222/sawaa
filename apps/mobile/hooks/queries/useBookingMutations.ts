import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  clientBookingsService,
} from '@/services/client';

import { clientBookingsKeys } from './useClientBookings';

interface CancelVars {
  id: string;
  reason: string;
  acceptedRefundTerms: true;
  quoteToken: string;
  sourceActionId?: string;
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation<Awaited<ReturnType<typeof clientBookingsService.cancel>>, Error, CancelVars>({
    mutationFn: ({ id, reason, acceptedRefundTerms, quoteToken, sourceActionId }) => clientBookingsService.cancel(id, reason, { acceptedRefundTerms, quoteToken, sourceActionId }),
    retry: false,
    // The cancellation screen localizes failures and refreshes stale quotes.
    onError: () => undefined,
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
    onError: (_error, vars) => {
      qc.invalidateQueries({ queryKey: clientBookingsKeys.detail(vars.id) });
    },
  });
}
