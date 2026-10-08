jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })) }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { WebView: (props: object) => React.createElement(View, { ...props, testID: 'bank-challenge' }) };
});
import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import appI18n from 'i18next';
import { CreditCard, WebviewPaymentAuth, PaymentConfig } from 'react-native-moyasar-sdk';

const config = new PaymentConfig({ givenId: 'a0000000-0000-4000-8000-000000000001', publishableApiKey: 'pk_test_fixture', amount: 5000, currency: 'SAR', description: 'Fixture' });

afterEach(() => jest.restoreAllMocks());
it('keeps the 3DS viewport inside its padded parent and updates height after rotation', () => {
  const dimensions = jest.mocked(require('react-native/Libraries/Utilities/useWindowDimensions').default).mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  const props = { transactionUrl: 'https://bank.example.test/challenge', onWebviewPaymentAuthResult: jest.fn() };
  const view = render(<WebviewPaymentAuth {...props} />);
  const containerStyle = () => view.UNSAFE_getAllByType(ReactNative.View).map(node => ReactNative.StyleSheet.flatten(node.props.style)).find(style => style?.height !== undefined);
  expect(containerStyle()).toMatchObject({ width: '100%', height: 844 });
  dimensions.mockReturnValue({ width: 844, height: 390, scale: 3, fontScale: 1 });
  view.rerender(<WebviewPaymentAuth {...props} />);
  expect(containerStyle()).toMatchObject({ width: '100%', height: 390 });
});
it('preserves the bank URL and the official callback result semantics', () => {
  const result = jest.fn();
  const view = render(<WebviewPaymentAuth transactionUrl="https://bank.example.test/challenge" onWebviewPaymentAuthResult={result} />);
  const bank = view.UNSAFE_getByProps({ testID: 'bank-challenge' });
  expect(bank.props.source).toEqual({ uri: 'https://bank.example.test/challenge' });
  expect(bank.props.onShouldStartLoadWithRequest({ url: 'https://bank.example.test/otp' })).toBe(true);
  expect(bank.props.onShouldStartLoadWithRequest({ url: 'https://sdk.moyasar.com/return?id=identity&status=paid&message=ok' })).toBe(false);
  expect(result).toHaveBeenCalledWith({ id: 'identity', status: 'paid', message: 'ok' });
});
it('localizes official fields, validation and alignment independently from app and device defaults', async () => {
  await appI18n.init({ lng: 'fr', resources: { fr: { translation: { untouched: 'bonjour' } } } });
  const view = render(<CreditCard paymentConfig={config} language="ar" onPaymentResult={jest.fn()} />);
  const card = view.getByPlaceholderText('رقم البطاقة');
  expect(ReactNative.StyleSheet.flatten(card.props.style).textAlign).toBe('right');
  fireEvent.changeText(card, '1');
  expect(view.getByText('رقم البطاقة غير صحيح')).toBeTruthy();
  await act(async () => { view.rerender(<CreditCard paymentConfig={config} language="en" onPaymentResult={jest.fn()} />); });
  const english = view.getByPlaceholderText('Card Number');
  expect(ReactNative.StyleSheet.flatten(english.props.style).textAlign).toBe('left');
  fireEvent.changeText(english, '1');
  expect(view.getByText('Invalid card number')).toBeTruthy();
  expect(appI18n.language).toBe('fr');
  expect(appI18n.t('untouched')).toBe('bonjour');
});

it('displays each current invoice amount without a cache shared by other forms', () => {
  const firstConfig = new PaymentConfig({ publishableApiKey: 'pk_test_fixture', amount: 1000, currency: 'USD', description: 'First' });
  const nextConfig = new PaymentConfig({ publishableApiKey: 'pk_test_fixture', amount: 2050, currency: 'USD', description: 'Second' });
  const first = render(<CreditCard paymentConfig={firstConfig} language="en" onPaymentResult={jest.fn()} />);
  expect(first.getByText('Pay $10.00')).toBeTruthy();
  const second = render(<CreditCard paymentConfig={nextConfig} language="en" onPaymentResult={jest.fn()} />);
  expect(second.getByText('Pay $20.50')).toBeTruthy();
  first.rerender(<CreditCard paymentConfig={nextConfig} language="en" onPaymentResult={jest.fn()} />);
  expect(first.getByText('Pay $20.50')).toBeTruthy();
});

it('isolates two live 3DS sessions and retains the same payment across a locale rerender', async () => {
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (_url, options) => {
    const request = JSON.parse(String(options?.body)) as { given_id: string; amount: number; currency: string };
    return { ok: true, json: async () => ({
      id: request.given_id, status: 'initiated', amount: request.amount, currency: request.currency,
      fee: 0, refunded: 0, captured: 0, amount_format: '50 SAR', fee_format: '0 SAR', refunded_format: '0 SAR', captured_format: '0 SAR',
      created_at: '2026-10-05T12:00:00Z', updated_at: '2026-10-05T12:00:00Z',
      source: { type: 'creditcard', company: 'visa', name: 'Test User', number: 'XXXX-1111', gateway_id: 'fixture',
        transaction_url: `https://bank.example.test/${request.given_id}`, reference_number: 'fixture', token: null, message: null },
    }) } as Response;
  });
  const resultA = jest.fn(); const resultB = jest.fn();
  const secondConfig = new PaymentConfig({ ...config, givenId: 'a0000000-0000-4000-8000-000000000002' });
  const fixture = (language: 'ar' | 'en') => <ReactNative.View>
    <ReactNative.View testID="form-a"><CreditCard paymentConfig={config} language={language} onPaymentResult={resultA} /></ReactNative.View>
    <ReactNative.View testID="form-b"><CreditCard paymentConfig={secondConfig} language="en" onPaymentResult={resultB} /></ReactNative.View>
  </ReactNative.View>;
  const rendered = render(fixture('en'));
  const first = within(rendered.getByTestId('form-a'));
  const second = within(rendered.getByTestId('form-b'));
  for (const view of [first, second]) {
    fireEvent.changeText(view.getByPlaceholderText('Name on Card'), 'Test User');
    fireEvent.changeText(view.getByPlaceholderText('Card Number'), '4111111111111111');
    fireEvent.changeText(view.getByPlaceholderText('Expiry (MM/YY)'), '1239');
    fireEvent.changeText(view.getByPlaceholderText('CVC'), '123');
    await act(async () => { fireEvent.press(view.getByText('Pay')); });
  }
  expect(first.UNSAFE_getByProps({ testID: 'bank-challenge' }).props.source.uri).toBe(`https://bank.example.test/${config.givenId}`);
  expect(second.UNSAFE_getByProps({ testID: 'bank-challenge' }).props.source.uri).toBe(`https://bank.example.test/${secondConfig.givenId}`);
  rendered.rerender(fixture('ar'));
  const bankA = first.UNSAFE_getByProps({ testID: 'bank-challenge' });
  expect(bankA.props.source.uri).toBe(`https://bank.example.test/${config.givenId}`);
  expect(fetch.mock.calls.map(([, options]) => JSON.parse(String(options?.body)).given_id)).toEqual([config.givenId, secondConfig.givenId]);
  act(() => bankA.props.onShouldStartLoadWithRequest({ url: `https://sdk.moyasar.com/return?id=${config.givenId}&status=paid&message=ok` }));
  expect(resultA.mock.calls[0][0]).toMatchObject({ id: config.givenId, status: 'paid', amount: 5000 });
  expect(resultB).not.toHaveBeenCalled();
  act(() => second.UNSAFE_getByProps({ testID: 'bank-challenge' }).props.onShouldStartLoadWithRequest({ url: `https://sdk.moyasar.com/return?id=${secondConfig.givenId}&status=paid&message=ok` }));
  expect(resultB.mock.calls[0][0]).toMatchObject({ id: secondConfig.givenId, status: 'paid', amount: 5000 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
