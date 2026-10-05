// SDK public entry eagerly imports its Android-only native component; stub that native boundary in Jest.
jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import { createPayment } from 'react-native-moyasar-sdk';
import { createNativePaymentConfig } from '../native-payment-config';
import type { NativePaymentConfiguration } from '@sawaa/shared';

export const config: NativePaymentConfiguration = {
  enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'], applePay: null,
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001',
  amount: 12500, currency: 'SAR', description: 'Invoice',
};

describe('native SDK configuration', () => {
  it('uses server amount and identity without coupons, tokenization or manual capture', () => {
    const result = createNativePaymentConfig(config);
    expect(result).toMatchObject({ amount: 12500, givenId: config.givenId, publishableApiKey: 'pk_test_fixture',
      baseUrl: 'https://api.moyasar.com', merchantCountryCode: 'SA', applyCoupon: false,
      createSaveOnlyToken: false, creditCard: { manual: false, saveCard: false } });
  });
  it.each([{ amount: 0 }, { amount: 1.2 }, { amount: NaN }, { givenId: 'invalid' },
    { publishableKey: 'sk_test_secret' }, { publishableKey: 'pk_live_key' }, { isLive: true },
    { currency: 'USD' }, { enabled: false }, { supportedNetworks: ['amex'] }])('rejects unsafe server configuration %p', (override) => {
    expect(() => createNativePaymentConfig({ ...config, ...override } as NativePaymentConfiguration)).toThrow('Invalid native payment configuration');
  });
  it('maps Apple Pay without enabling saved cards', () => {
    expect(createNativePaymentConfig({ ...config, applePay: { merchantId: 'merchant.sa.sawa', label: 'Sawa', countryCode: 'SA' } }).applePay)
      .toEqual({ merchantId: 'merchant.sa.sawa', label: 'Sawa', manual: false, saveCard: false });
  });
});

it('never logs raw provider rejection payloads through the patched official SDK', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 422, json: async () => ({ type: 'validation_error', message: 'synthetic-private-provider-data' }) } as Response);
  try {
    await createPayment({ baseUrl: 'https://api.moyasar.com', toJson: () => ({}), source: { type: 'creditcard' } } as Parameters<typeof createPayment>[0], 'pk_test_fixture');
    expect(error).not.toHaveBeenCalled(); expect(debug).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally { fetch.mockRestore(); error.mockRestore(); debug.mockRestore(); }
});
