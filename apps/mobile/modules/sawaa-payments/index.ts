import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export function canUseApplePay(networks: string[]): boolean {
  if (Platform.OS !== 'ios' || !networks.length
    || networks.some((network) => !['mada', 'visa', 'mastercard'].includes(network))) return false;
  try {
    const native = requireOptionalNativeModule<{ canUseApplePay(networks: string[]): boolean }>('SawaaPayments');
    return native?.canUseApplePay(networks) === true;
  } catch {
    return false;
  }
}
