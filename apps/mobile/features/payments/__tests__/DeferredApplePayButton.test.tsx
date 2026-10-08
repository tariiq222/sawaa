import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { NativePaymentConfiguration } from '@sawaa/shared';
import { GeneralError } from 'react-native-moyasar-sdk';
import { DeferredApplePayButton } from '../DeferredApplePayButton';

const mockShow = jest.fn();
const mockWalletRequest = jest.fn();
const mockCreatePayment = jest.fn();
const mockCanUseApplePay = jest.fn();
let mockScheme = 'light';
const mockNativeButtonProps = jest.fn();

jest.mock('expo-constants', () => ({ expoConfig: { extra: { applePayMerchantId: 'merchant.sa.sawa' } } }));
jest.mock('@/modules/sawaa-payments', () => ({ canUseApplePay: (...args: unknown[]) => mockCanUseApplePay(...args) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: mockScheme }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-moyasar-sdk', () => ({
  ...jest.requireActual('react-native-moyasar-sdk/src/models/payment_config'),
  ...jest.requireActual('react-native-moyasar-sdk/src/models/apple_pay_config'),
  ...jest.requireActual('react-native-moyasar-sdk/src/models/credit_card_config'),
  ...jest.requireActual('react-native-moyasar-sdk/src/models/api/api_requests/payment_request'),
  ...jest.requireActual('react-native-moyasar-sdk/src/models/api/sources/apple_pay/apple_pay_request_source'),
  ...jest.requireActual('react-native-moyasar-sdk/src/models/errors/moyasar_errors'),
  createPayment: (...args: unknown[]) => mockCreatePayment(...args),
}));
jest.mock('react-native-moyasar-sdk/src/react_native_apple_pay', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    ApplePayButton: (props: { onPress: () => void }) => {
      mockNativeButtonProps(props);
      return React.createElement(Pressable, { testID: 'native-wallet-button', onPress: props.onPress });
    },
    PaymentRequest: class {
      constructor(...args: unknown[]) { mockWalletRequest(...args); }
      show() { return mockShow(); }
    },
  };
});

const config: NativePaymentConfiguration = {
  enabled: true, isLive: false, supportedNetworks: ['mada', 'visa'],
  applePay: { merchantId: 'merchant.sa.sawa', label: 'Sawa', countryCode: 'SA' },
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001',
  amount: 12501, currency: 'SAR', description: 'Server invoice',
};
const token = { data: 'fixture-token', signature: 'fixture-signature', version: 'EC_v1' };
const complete = jest.fn();
const onResult = jest.fn();
const onCancel = jest.fn();
const onError = jest.fn();
const prepare = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function subject(disabled = false) {
  return render(<DeferredApplePayButton disabled={disabled} prepare={prepare} onError={onError} />);
}
async function press(screen: ReturnType<typeof subject>) {
  await act(async () => { fireEvent.press(screen.getByTestId('native-wallet-button')); });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockScheme = 'light';
  mockCanUseApplePay.mockReturnValue(true);
  prepare.mockResolvedValue({ config, onResult, onCancel, isCurrent: () => true });
  mockShow.mockResolvedValue({ details: { paymentData: token }, complete });
  complete.mockResolvedValue(undefined);
  mockCreatePayment.mockResolvedValue({ status: 'paid', source: { number: 'sensitive-fixture' } });
});

// A missing prepare await or preview amount substitution breaks this boundary contract.
it('prepares once on one native tap and opens Wallet with authoritative server values', async () => {
  const screen = subject();
  expect(prepare).not.toHaveBeenCalled();
  await press(screen);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(mockWalletRequest).toHaveBeenCalledWith([
    { supportedMethods: ['apple-pay'], data: { merchantIdentifier: 'merchant.sa.sawa',
      supportedNetworks: ['mada', 'visa'], countryCode: 'SA', currencyCode: 'SAR' } },
  ], { total: { label: 'Sawa', amount: { currency: 'SAR', value: '125.01' } } });
  const [request, key] = mockCreatePayment.mock.calls[0];
  expect(request.toJson()).toEqual({ given_id: 'a0000000-0000-4000-8000-000000000001',
    amount: 12501, currency: 'SAR', description: 'Server invoice', metadata: undefined,
    source: { type: 'applepay', token, manual: 'false', save_card: false },
    callback_url: undefined, apply_coupon: false, splits: undefined });
  expect(key).toBe('pk_test_fixture');
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledWith('success');
  expect(onResult.mock.calls).toEqual([[]]);
  expect(onError).not.toHaveBeenCalled();
});

it('uses the native Pay with Apple Pay type and theme at the existing control size', () => {
  const screen = subject();
  expect(mockNativeButtonProps).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'inStore', style: 'black', width: '100%', height: 50,
  }));
  mockScheme = 'dark';
  screen.rerender(<DeferredApplePayButton disabled={false} prepare={prepare} onError={onError} />);
  expect(mockNativeButtonProps).toHaveBeenLastCalledWith(expect.objectContaining({ style: 'white' }));
});

it('blocks repeated taps across preparation, Wallet and provider processing', async () => {
  const preparation = deferred<Awaited<ReturnType<typeof prepare>>>();
  const wallet = deferred<{ details: { paymentData: typeof token }; complete: typeof complete }>();
  const provider = deferred<{ status: string }>();
  prepare.mockReturnValue(preparation.promise);
  mockShow.mockReturnValue(wallet.promise);
  mockCreatePayment.mockReturnValue(provider.promise);
  const screen = subject();
  await press(screen); await press(screen);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button').props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => { preparation.resolve({ config, onResult, isCurrent: () => true }); });
  await press(screen);
  expect(mockShow).toHaveBeenCalledTimes(1);
  await act(async () => { wallet.resolve({ details: { paymentData: token }, complete }); });
  await press(screen);
  expect(mockCreatePayment).toHaveBeenCalledTimes(1);
  await act(async () => { provider.resolve({ status: 'paid' }); });
  expect(onResult.mock.calls).toEqual([[]]);
});

it('blocks disabled taps without preparing', async () => {
  await press(subject(true));
  expect(prepare).not.toHaveBeenCalled();
  expect(mockShow).not.toHaveBeenCalled();
});

it('does not show Wallet when prepare delegates to existing verification', async () => {
  prepare.mockResolvedValue(null);
  await press(subject());
  expect(mockShow).not.toHaveBeenCalled();
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(onResult).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

it.each(['failed', 'authorized', 'initiated'])('completes %s provider status as failure and reconciles once', async (status) => {
  mockCreatePayment.mockResolvedValue({ status });
  await press(subject());
  expect(complete.mock.calls).toEqual([['failure']]);
  expect(onResult.mock.calls).toEqual([[]]);
  expect(onError).not.toHaveBeenCalled();
});

it('completes an SDK error as failure even if its payload claims paid', async () => {
  mockCreatePayment.mockResolvedValue(Object.assign(new GeneralError('fixture'), { status: 'paid' }));
  await press(subject());
  expect(complete.mock.calls).toEqual([['failure']]);
  expect(onResult.mock.calls).toEqual([[]]);
});

it('reconciles an ambiguous transport failure after token without exposing it', async () => {
  mockCreatePayment.mockRejectedValue(new Error('fixture-provider-error'));
  await press(subject());
  expect(complete.mock.calls).toEqual([['failure']]);
  expect(onResult.mock.calls).toEqual([[]]);
  expect(onError).not.toHaveBeenCalled();
});

it.each([new Error('AbortError'), Object.assign(new Error('user dismissed'), { name: 'AbortError' })])(
  'preserves native cancellation and restores interaction without charging', async (error) => {
    mockShow.mockRejectedValueOnce(error);
    const screen = subject();
    await press(screen);
    expect(onCancel.mock.calls).toEqual([[]]);
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    await press(screen);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(onResult.mock.calls).toEqual([[]]);
  },
);

it.each([
  { ...config, applePay: { ...config.applePay!, merchantId: 'merchant.other' } },
  { ...config, applePay: null },
  { ...config, givenId: 'invalid-id' },
  { ...config, amount: 0 },
  { ...config, enabled: false },
])('fails closed for invalid payable configuration before Wallet or charging', async (invalid) => {
  prepare.mockResolvedValue({ config: invalid, onResult, onCancel, isCurrent: () => true });
  await press(subject());
  expect(mockShow).not.toHaveBeenCalled();
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(onError.mock.calls).toEqual([[]]);
  expect(onResult).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
});

it('checks native capability again before Wallet', async () => {
  mockCanUseApplePay.mockReturnValue(false);
  await press(subject());
  expect(mockShow).not.toHaveBeenCalled();
  expect(onError.mock.calls).toEqual([[]]);
});

it('handles an unknown sheet error generically and permits another tap', async () => {
  mockShow.mockRejectedValueOnce(new Error('fixture-setup-error'));
  const screen = subject();
  await press(screen);
  expect(onError.mock.calls).toEqual([[]]);
  expect(onCancel).not.toHaveBeenCalled();
  expect(onResult).not.toHaveBeenCalled();
  await press(screen);
  expect(prepare).toHaveBeenCalledTimes(2);
});

it('closes a missing-token response as failure without charging or inventing a provider outcome', async () => {
  mockShow.mockResolvedValue({ details: { paymentData: null }, complete });
  await press(subject());
  expect(complete.mock.calls).toEqual([['failure']]);
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(onError.mock.calls).toEqual([[]]);
  expect(onResult).not.toHaveBeenCalled();
});

it('captures attempt callbacks even when the parent renders new callbacks while Wallet is open', async () => {
  const wallet = deferred<{ details: { paymentData: typeof token }; complete: typeof complete }>();
  mockShow.mockReturnValue(wallet.promise);
  const screen = subject();
  await press(screen);
  const nextResult = jest.fn();
  const nextPrepare = jest.fn().mockResolvedValue({ config, onResult: nextResult, isCurrent: () => true });
  screen.rerender(<DeferredApplePayButton disabled={false} prepare={nextPrepare} onError={jest.fn()} />);
  await act(async () => { wallet.resolve({ details: { paymentData: token }, complete }); });
  expect(onResult.mock.calls).toEqual([[]]);
  expect(nextResult).not.toHaveBeenCalled();
});

it('reconciles once even if native completion rejects', async () => {
  complete.mockRejectedValue(new Error('fixture-completion-error'));
  await press(subject());
  expect(complete.mock.calls).toEqual([['success']]);
  expect(onResult.mock.calls).toEqual([[]]);
  expect(onError).not.toHaveBeenCalled();
});

it('never submits a token if ownership changes while Wallet is authorizing', async () => {
  let valid = true;
  const response = deferred<{ details: { paymentData: typeof token }; complete: typeof complete }>();
  prepare.mockResolvedValue({ config, onResult, onCancel, isCurrent: () => valid });
  mockShow.mockReturnValue(response.promise);
  const screen = subject(); await press(screen);
  valid = false;
  await act(async () => { response.resolve({ details: { paymentData: token }, complete }); });
  expect(mockCreatePayment).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledWith('failure'); expect(onResult).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledTimes(1);
});
