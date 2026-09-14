import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BookMyPackageCreditInput,
  ClientPackagePurchase,
  InitPackagePurchaseInput,
  InitPackagePurchaseResponse,
  PackageFamily,
} from '@sawaa/shared/types';

import { clientPackagesService } from '@/services/client';

import { clientBookingsKeys } from './useClientBookings';

export const packageKeys = {
  all: ['packages'] as const,
  families: () => [...packageKeys.all, 'families'] as const,
  family: (id: string) => [...packageKeys.families(), id] as const,
  purchases: () => [...packageKeys.all, 'purchases'] as const,
  purchase: (id: string) => [...packageKeys.purchases(), id] as const,
};

export function usePackageFamilies() {
  return useQuery<PackageFamily[]>({
    queryKey: packageKeys.families(),
    queryFn: () => clientPackagesService.listFamilies(),
  });
}

export function usePackageFamily(id: string | undefined) {
  return useQuery<PackageFamily>({
    queryKey: packageKeys.family(id ?? ''),
    queryFn: () => clientPackagesService.getFamily(id as string),
    enabled: Boolean(id),
  });
}

export function usePackagePurchases() {
  return useQuery<ClientPackagePurchase[]>({
    queryKey: packageKeys.purchases(),
    queryFn: () => clientPackagesService.listPurchases(),
  });
}

export function usePackagePurchase(id: string | undefined) {
  return useQuery<ClientPackagePurchase>({
    queryKey: packageKeys.purchase(id ?? ''),
    queryFn: () => clientPackagesService.getPurchase(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => query.state.data?.status === 'PENDING' ? 3000 : false,
  });
}

export function useInitPackagePurchase() {
  return useMutation<InitPackagePurchaseResponse, Error, InitPackagePurchaseInput>({
    mutationFn: (input) => clientPackagesService.initPurchase(input),
  });
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
