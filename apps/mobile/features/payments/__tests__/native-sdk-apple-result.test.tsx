jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: () => 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native-moyasar-sdk/lib/module/react_native_apple_pay', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    ApplePayButton: (props: { onPress: () => void }) => React.createElement(Pressable, { onPress: props.onPress, testID: 'official-apple-button' }),
    PaymentRequest: jest.fn().mockImplementation(() => ({ show: mockShowSheet })),
  };
});
jest.mock('react-native-moyasar-sdk/lib/module/services/payment_service', () => ({ createPayment: (...args: unknown[]) => mockCreatePayment(...args) }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ApplePay, ApplePayConfig, NetworkError, PaymentConfig } from 'react-native-moyasar-sdk';

const mockShowSheet = jest.fn();
const mockCreatePayment = jest.fn();
const config = new PaymentConfig({
  givenId: 'a0000000-0000-4000-8000-000000000001', publishableApiKey: 'pk_test_fixture',
  amount: 5000, currency: 'SAR', description: 'Fixture',
  applePay: new ApplePayConfig({ merchantId: 'merchant.fixture', label: 'Fixture', manual: false }),
});
const complete = jest.fn();
const result = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockShowSheet.mockResolvedValue({ details: { paymentData: 'synthetic-token' }, complete });
});
async function pay() {
  const view = render(<ApplePay paymentConfig={config} onPaymentResult={result} />);
  await act(async () => { fireEvent.press(view.getByTestId('official-apple-button')); });
}

it.each([
  ['paid', 'success'], ['failed', 'failure'], ['initiated', 'failure'], ['authorized', 'failure'],
])('completes the native Apple sheet with the actual %s result', async (status, expected) => {
  const response = { id: config.givenId, status, amount: 5000, currency: 'SAR' };
  mockCreatePayment.mockResolvedValue(response);
  await pay();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledWith(expected);
  expect(result).toHaveBeenCalledWith(response);
  expect(mockCreatePayment.mock.calls[0][0].givenId).toBe(config.givenId);
});
it('does not signal Apple success on an ambiguous request failure and still triggers reconciliation', async () => {
  mockCreatePayment.mockRejectedValue(new Error('Fixture network timeout'));
  await pay();
  expect(complete).toHaveBeenCalledWith('failure');
  expect(result).toHaveBeenCalledTimes(1);
});
it('creates no provider payment or success result when the customer cancels the sheet', async () => {
  mockShowSheet.mockRejectedValue(new Error('AbortError'));
  await pay();
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  expect(result).not.toHaveBeenCalled();
});
it('fails the sheet without creating a payment when no Apple token is available', async () => {
  mockShowSheet.mockResolvedValue({ details: {}, complete });
  await pay();
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledWith('failure');
  expect(result).toHaveBeenCalledTimes(1);
});

it('does not mark a resolved SDK error object as Apple success', async () => {
  const error = new NetworkError('Fixture timeout');
  mockCreatePayment.mockResolvedValue(error);
  await pay();
  expect(complete).toHaveBeenCalledWith('failure');
  expect(result).toHaveBeenCalledWith(error);
});
