import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import type { NativePaymentCapabilities } from '@sawaa/shared';
import { useAppSelector } from '@/hooks/use-redux';
import { clientPaymentsService } from '@/services/client/payments';
import { canUseApplePay } from '@/modules/sawaa-payments';

export async function canUseNativeApplePay(
  config: NativePaymentCapabilities, builtMerchantId: string | undefined,
): Promise<boolean> {
  return Boolean(config.enabled && config.applePay && builtMerchantId
    && config.applePay.countryCode === 'SA'
    && config.applePay.merchantId === builtMerchantId
    && canUseApplePay(config.supportedNetworks));
}

export function useNativePaymentCapabilities() {
  const clientId = useAppSelector((state) => state.auth.user?.id);
  const query = useQuery({
    queryKey: ['native-payment-capabilities', clientId],
    enabled: Boolean(clientId), staleTime: 0, retry: false,
    queryFn: async () => {
      const config = await clientPaymentsService.getNativeConfig();
      return {
        enabled: config.enabled,
        applePayAvailable: await canUseNativeApplePay(config, Constants.expoConfig?.extra?.applePayMerchantId),
      };
    },
  });
  return {
    enabled: Boolean(clientId && query.data?.enabled && !query.isError),
    applePayAvailable: Boolean(clientId && query.data?.applePayAvailable && !query.isError),
    isLoading: query.isLoading, isError: query.isError,
    refetch: () => { void query.refetch(); },
  };
}
