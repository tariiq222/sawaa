import { useQuery } from '@tanstack/react-query';

import { publicPaymentMethodsService, type PublicPaymentMethods } from '@/services/client/payment-methods';

export const publicPaymentMethodsKeys = {
  all: ['public-payment-methods'] as const,
};

/**
 * Which payment methods this deployment can actually complete. Drives the
 * client-facing booking step; the same flags gate the website so both surfaces
 * agree with the admin switch in Settings.
 */
export function usePublicPaymentMethods() {
  return useQuery<PublicPaymentMethods>({
    queryKey: publicPaymentMethodsKeys.all,
    queryFn: () => publicPaymentMethodsService.get(),
    staleTime: 60 * 1000,
  });
}
