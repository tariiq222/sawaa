import { useMutation } from '@tanstack/react-query';
import { clientPhoneService } from '@/services/client-phone';

export const clientPhoneKeys = {
  all: ['client', 'phone'] as const,
};

/** Challenge and verification responses stay in screen memory; nothing is cached. */
export function useRequestClientPhone() {
  return useMutation({
    mutationFn: (body: { phone: string }) => clientPhoneService.request(body),
  });
}

/**
 * A successful verify revokes every previous token. Nothing may refetch until
 * the screen has persisted the rotated tokens, so this hook deliberately has no
 * onSuccess invalidation; the screen invalidates profile reads afterwards.
 */
export function useVerifyClientPhone() {
  return useMutation({
    mutationFn: (body: { challengeId: string; code: string }) => clientPhoneService.verify(body),
    // The result carries fresh tokens; do not keep it in the mutation cache.
    gcTime: 0,
  });
}
