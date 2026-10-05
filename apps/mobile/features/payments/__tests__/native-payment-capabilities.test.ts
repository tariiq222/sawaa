jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: {} }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: jest.fn() }));
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { canUseNativeApplePay } from '../native-payment-capabilities';
const ready = { enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'] as const,
  applePay: { merchantId: 'merchant.sa.sawa', label: 'Sawa', countryCode: 'SA' as const } };
const config = { ...ready, supportedNetworks: [...ready.supportedNetworks] };
beforeEach(() => { Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true }); jest.mocked(requireOptionalNativeModule).mockReturnValue({ canUseApplePay: jest.fn(() => true) }); });
it('requires matching built merchant and a capable Wallet', async () => {
  expect(await canUseNativeApplePay(config, 'merchant.sa.sawa')).toBe(true);
  expect(await canUseNativeApplePay(config, 'merchant.other')).toBe(false);
  expect(await canUseNativeApplePay(config, undefined)).toBe(false);
  expect(await canUseNativeApplePay({ ...config, applePay: null }, 'merchant.sa.sawa')).toBe(false);
});
it('fails closed on Android, absent module, exceptions and incapable Wallet', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  expect(await canUseNativeApplePay(config, 'merchant.sa.sawa')).toBe(false);
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  expect(await canUseNativeApplePay(config, 'merchant.sa.sawa')).toBe(false);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ canUseApplePay: () => false });
  expect(await canUseNativeApplePay(config, 'merchant.sa.sawa')).toBe(false);
  jest.mocked(requireOptionalNativeModule).mockImplementation(() => { throw new Error('absent'); });
  expect(await canUseNativeApplePay(config, 'merchant.sa.sawa')).toBe(false);
});
