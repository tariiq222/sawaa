import { useQuery } from '@tanstack/react-query';
import { clientPaymentsService } from '@/services/client/payments';

export const bankTransferSettingsKeys = { detail: ['client-payments', 'bank-transfer-settings'] as const };

export function useBankTransferSettings() {
  return useQuery({
    queryKey: bankTransferSettingsKeys.detail,
    queryFn: clientPaymentsService.getBankTransferSettings,
    staleTime: 60_000,
    retry: 1,
  });
}
