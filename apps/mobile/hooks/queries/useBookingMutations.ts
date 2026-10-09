import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  clientBookingsService,
} from '@/services/client';

import { useAppSelector } from '@/hooks/use-redux';
import { clearClosedBookingCheckout } from '@/features/booking/payment-resume-state';

import { clientBookingsKeys } from './useClientBookings';
import { invalidateClientBookingResources } from './invalidateClientBookingResources';

interface CancelVars {
  id: string;
  reason: string;
  acceptedRefundTerms: true;
  quoteToken: string;
  sourceActionId?: string;
}

export function useCancelBooking() {
  const qc = useQueryClient();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  return useMutation<Awaited<ReturnType<typeof clientBookingsService.cancel>>, Error, CancelVars, { userId: string | null }>({
    mutationFn: ({ id, reason, acceptedRefundTerms, quoteToken, sourceActionId }) => clientBookingsService.cancel(id, reason, { acceptedRefundTerms, quoteToken, sourceActionId }),
    retry: false,
    onMutate: () => ({ userId }),
    // The cancellation screen localizes failures and refreshes stale quotes.
    onError: () => undefined,
    onSuccess: async (data, vars, context) => {
      if (data.id === vars.id && data.status === 'cancelled' && data.requiresApproval !== true && context?.userId) {
        // Storage failure cannot turn a committed cancellation into a failed mutation.
        // A new wizard also verifies closed records with the server before retiring them.
        await clearClosedBookingCheckout(context.userId, vars.id).catch(() => undefined);
      }
      await Promise.all([
        invalidateClientBookingResources(qc),
        qc.invalidateQueries({ queryKey: clientBookingsKeys.detail(vars.id) }),
      ]);
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
