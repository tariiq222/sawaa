import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BookMyPackageCreditInput,
  InitPackagePurchaseInput,
  NativePackagePurchaseInitResponse,
} from '@sawaa/shared/types';

import { useCallback } from 'react';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';
import { useAppSelector } from '@/hooks/use-redux';
import { PACKAGE_PAYMENT_POLL_INTERVAL_MS } from '@/lib/package-utils';
import { clientPackagesService } from '@/services/client';
import type { ClientPackageFamily, ClientPackagePurchaseRow } from '@/services/client/packages';

import { clientBookingsKeys } from './useClientBookings';

export const packageKeys = {
  all: ['packages'] as const,
  families: () => [...packageKeys.all, 'families'] as const,
  family: (id: string) => [...packageKeys.families(), id] as const,
  purchases: () => [...packageKeys.all, 'purchases'] as const,
  purchase: (id: string) => [...packageKeys.purchases(), id] as const,
};

export function usePackageFamilies() {
  return useQuery<ClientPackageFamily[]>({
    queryKey: packageKeys.families(),
    queryFn: () => clientPackagesService.listFamilies(),
  });
}

export function usePackageFamily(id: string | undefined) {
  return useQuery<ClientPackageFamily>({
    queryKey: packageKeys.family(id ?? ''),
    queryFn: () => clientPackagesService.getFamily(id as string),
    enabled: Boolean(id),
  });
}

export function usePackagePurchases() {
  const clientId = useAppSelector((state) => state.auth.user?.id);
  return useQuery<ClientPackagePurchaseRow[]>({
    queryKey: [...packageKeys.purchases(), clientId],
    enabled: Boolean(clientId),
    queryFn: () => clientPackagesService.listPurchases(),
  });
}

/**
 * Reads one purchase. While `poll` is true and the purchase is PENDING it
 * refetches every few seconds; callers bound the polling by flipping `poll`
 * off (a declined or abandoned checkout stays PENDING on the server).
 */
export function usePackagePurchase(id: string | undefined, options: { poll?: boolean } = {}) {
  const poll = options.poll ?? true;
  const clientId = useAppSelector((state) => state.auth.user?.id);
  return useQuery<ClientPackagePurchaseRow>({
    queryKey: [...packageKeys.purchase(id ?? ''), clientId],
    queryFn: () => clientPackagesService.getPurchase(id as string),
    enabled: Boolean(id && clientId),
    refetchInterval: (query) => poll && query.state.data?.status === 'PENDING' ? PACKAGE_PAYMENT_POLL_INTERVAL_MS : false,
  });
}

export function useInitPackagePurchase() {
  const mutation = useMutation<NativePackagePurchaseInitResponse, Error, { input: InitPackagePurchaseInput; epoch: number }>({
    mutationFn: ({ input, epoch }) => {
      if (!isSessionCurrent(epoch)) throw new Error('Session changed during package checkout');
      return clientPackagesService.initPurchase(input);
    },
  });
  const { mutateAsync: runMutationAsync, mutate: runMutation } = mutation;
  const mutateAsync = useCallback((input: InitPackagePurchaseInput) =>
    runMutationAsync({ input, epoch: getSessionEpoch() }), [runMutationAsync]);
  const mutate = useCallback((input: InitPackagePurchaseInput) =>
    runMutation({ input, epoch: getSessionEpoch() }), [runMutation]);
  return { ...mutation, mutateAsync, mutate };
}

export function useBookPackageCredit() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, BookMyPackageCreditInput>({
    mutationFn: (input) => clientPackagesService.bookCredit(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packageKeys.purchases() });
      void queryClient.invalidateQueries({ queryKey: clientBookingsKeys.all });
    },
  });
}
