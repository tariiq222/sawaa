let mockAppLanguage = 'ar';
const mockCardLanguage = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockAppLanguage, resolvedLanguage: mockAppLanguage } }) }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { applePayMerchantId: 'merchant.sa.sawa' } } }));
jest.mock('@/modules/sawaa-payments', () => ({ canUseApplePay: () => true }));
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativePaymentForm } from '../NativePaymentForm';
jest.mock('react-native-moyasar-sdk', () => {
  const { Pressable, Text } = require('react-native');
  const React = require('react');
  const button = (name: string) => ({ onPaymentResult, language }: { onPaymentResult: (result: unknown) => void; language?: string }) => { if (name === 'official-card') mockCardLanguage(language); return React.createElement(Pressable,
    { onPress: () => onPaymentResult({ status: 'paid', source: { number: 'sensitive' } }) }, React.createElement(Text, null, name)); };
  return { CreditCard: button('official-card'), ApplePay: button('official-apple'), PaymentConfig: class { constructor(values: object) { Object.assign(this, values); } }, CreditCardConfig: class {}, ApplePayConfig: class {} };
});
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ teal: { 600: 'teal' }, ink: { 900: 'black', 500: 'gray' } }) }));
const config = { enabled: true, isLive: false, supportedNetworks: ['mada' as const], applePay: null,
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001', amount: 12500, currency: 'SAR', description: 'Invoice' };
it('uses official cards for the chosen card method and discards raw SDK callback data', () => {
  const callback = jest.fn();
  const screen = render(<NativePaymentForm config={config} method="ONLINE_CARD" applePayAvailable={false} onResult={callback} />);
  fireEvent.press(screen.getByText('official-card'));
  expect(callback).toHaveBeenCalledWith(); expect(screen.queryByText('official-apple')).toBeNull();
});
it('renders the official Apple Pay component only when capability and config are ready', () => {
  const screen = render(<NativePaymentForm config={{ ...config, applePay: { merchantId: 'merchant.sa.sawa', label: 'Sawa', countryCode: 'SA' } }} method="APPLE_PAY" applePayAvailable onResult={jest.fn()} />);
  expect(screen.getByText('official-apple')).toBeTruthy();
});

it('fails closed when the payable configuration merchant differs from the built entitlement', () => {
  const screen = render(<NativePaymentForm config={{ ...config, applePay: { merchantId: 'merchant.other', label: 'Other', countryCode: 'SA' } }} method="APPLE_PAY" applePayAvailable onResult={jest.fn()} />);
  expect(screen.queryByText('official-apple')).toBeNull();
  expect(screen.queryByText('official-card')).toBeNull();
  expect(screen.getByText('nativePayment.appleUnavailable')).toBeTruthy();
});

it('offers an explicit card choice without silently changing the Apple payment method', () => {
  const choice = jest.fn();
  const screen = render(<NativePaymentForm config={config} method="APPLE_PAY" applePayAvailable={false} onResult={jest.fn()} onSelectCard={choice} />);
  expect(screen.queryByText('official-card')).toBeNull();
  fireEvent.press(screen.getByText('nativePayment.useCard'));
  expect(choice).toHaveBeenCalledTimes(1);
});

it('passes the current app language through the documented local SDK extension', () => {
  mockAppLanguage = 'ar';
  const view = render(<NativePaymentForm config={config} method="ONLINE_CARD" applePayAvailable={false} onResult={jest.fn()} />);
  expect(mockCardLanguage).toHaveBeenLastCalledWith('ar');
  mockAppLanguage = 'en';
  view.rerender(<NativePaymentForm config={config} method="ONLINE_CARD" applePayAvailable={false} onResult={jest.fn()} />);
  expect(mockCardLanguage).toHaveBeenLastCalledWith('en');
});
