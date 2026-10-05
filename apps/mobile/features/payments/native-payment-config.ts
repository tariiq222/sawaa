import { ApplePayConfig, CreditCardConfig, PaymentConfig } from 'react-native-moyasar-sdk';
import type { NativePaymentConfiguration } from '@sawaa/shared';

export function createNativePaymentConfig(config: NativePaymentConfiguration): PaymentConfig {
  const keyPrefix = config.isLive ? 'pk_live_' : 'pk_test_';
  if (!config.enabled || !Number.isSafeInteger(config.amount) || config.amount <= 0
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.givenId)
    || !config.publishableKey?.startsWith(keyPrefix) || config.publishableKey.length <= keyPrefix.length
    || config.currency !== 'SAR' || !config.description?.trim()
    || !config.supportedNetworks?.length
    || config.supportedNetworks.some((network) => !['mada', 'visa', 'mastercard'].includes(network))
    || (config.applePay && (config.applePay.countryCode !== 'SA'
      || !/^merchant\.[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/.test(config.applePay.merchantId)
      || !config.applePay.label?.trim()))) {
    throw new Error('Invalid native payment configuration');
  }
  return new PaymentConfig({
    givenId: config.givenId, publishableApiKey: config.publishableKey,
    amount: config.amount, currency: config.currency, description: config.description,
    merchantCountryCode: 'SA', supportedNetworks: config.supportedNetworks,
    creditCard: new CreditCardConfig({ manual: false, saveCard: false }),
    createSaveOnlyToken: false, applyCoupon: false,
    ...(config.applePay ? { applePay: new ApplePayConfig({
      merchantId: config.applePay.merchantId, label: config.applePay.label, manual: false, saveCard: false,
    }) } : {}),
  });
}
