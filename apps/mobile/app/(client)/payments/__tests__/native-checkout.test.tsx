jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) }));
import fs from 'node:fs';
import path from 'node:path';
import { ScrollView, StyleSheet } from 'react-native';
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
import * as WebBrowser from 'expo-web-browser';
import { getPendingPackagePurchase } from '@/services/client/packages';
jest.mock('@/services/client/packages', () => ({ getPendingPackagePurchase: jest.fn() }));
import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import NativeCheckout from '../native-checkout';
const mockReplace = jest.fn();
const mockDismiss = jest.fn();
const mockReconcile = jest.fn();
const mockRetry = jest.fn();
const mockPaymentResult = jest.fn();
const mockCheckoutInput = jest.fn();
let mockParams: Record<string, string> = { invoiceId: 'invoice', bookingId: 'booking' };
let mockCapabilities = { enabled: true, isLoading: false, isError: false, applePayAvailable: false, refetch: jest.fn() };
let mockPaymentId: string | null = 'payment';
let mockClientId = 'client';
let mockUnavailableReason: string | undefined;
let mockPhase = 'pending';
let mockCanResume = true;
let mockConfig: object | null = null;
const mockMount = jest.fn();
const mockUnmount = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ replace: mockReplace, dismiss: mockDismiss, back: jest.fn(), canGoBack: () => false }), Stack: { Screen: () => null } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockClientId }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ ink: { 900: 'black', 500: 'gray' }, teal: { 600: 'teal', 700: 'teal' }, surface: 'white' }) }));
let mockFormProps: { onResult: (outcome: 'submitted' | 'rejected') => void } | undefined;
jest.mock('@/features/payments/NativePaymentForm', () => ({ NativePaymentForm: (props: { onResult: (outcome: 'submitted' | 'rejected') => void }) => { const React = require('react'); mockFormProps = props; React.useEffect(() => { mockMount(); return () => mockUnmount(); }, []); return null; } }));
jest.mock('@/features/payments/native-payment-capabilities', () => ({ useNativePaymentCapabilities: () => mockCapabilities }));
jest.mock('@/features/payments/use-native-payment-checkout', () => ({ useNativePaymentCheckout: (input: unknown) => { mockCheckoutInput(input); return { phase: mockPhase, config: mockConfig, paymentId: mockPaymentId, canResume: mockCanResume, reconcile: mockReconcile, retryInitialization: mockRetry, onPaymentResult: mockPaymentResult, error: null, unavailableReason: mockUnavailableReason }; } }));
beforeEach(() => { mockPaymentId = 'payment'; mockClientId = 'client'; mockUnavailableReason = undefined; mockConfig = null; mockCanResume = true; mockPhase = 'pending'; mockParams = { invoiceId: 'invoice', bookingId: 'booking' }; mockCapabilities = { enabled: true, isLoading: false, isError: false, applePayAvailable: false, refetch: jest.fn() }; jest.clearAllMocks(); });
it('offers only verification when the provider-created challenge cannot be recovered', () => {
  mockCanResume = false;
  const view = render(<NativeCheckout />);
  expect(view.getByText('nativePayment.awaitingVerification')).toBeTruthy();
  expect(view.queryByText('nativePayment.resume')).toBeNull();
  fireEvent.press(view.getByText('nativePayment.checkAgain'));
  expect(mockReconcile).toHaveBeenCalled(); expect(mockRetry).not.toHaveBeenCalled();
});
it('keeps pending results on screen and allows explicit reconciliation', () => {
  const view = render(<NativeCheckout />);
  expect(view.getByText('nativePayment.pending')).toBeTruthy();
  fireEvent.press(view.getByText('nativePayment.checkAgain'));
  expect(mockReconcile).toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('navigates only from confirmed completion and never maps native completion to cancellation', () => {
  mockPhase = 'completed'; render(<NativeCheckout />);
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment', webResult: 'native' } });
  const destination = mockReplace.mock.calls[0][0];
  expect(fs.existsSync(path.resolve(__dirname, '../..', destination.pathname.replace(/^\/\(client\)\//, '') + '.tsx'))).toBe(true);
  expect(mockDismiss).not.toHaveBeenCalled();
});
it('removes the retained booking confirmation before showing authoritative success', () => {
  mockParams.fromBookingConfirm = 'true';
  const view = render(<NativeCheckout />);
  expect(mockDismiss).not.toHaveBeenCalled();
  mockPhase = 'completed'; view.rerender(<NativeCheckout />);
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalledWith(1);
  expect(mockDismiss.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment', webResult: 'native' } });
});
it('keeps review-needed results visible without success navigation', () => {
  mockPhase = 'review'; const view = render(<NativeCheckout />);
  expect(view.getByText('nativePayment.review')).toBeTruthy(); expect(mockReplace).not.toHaveBeenCalled();
});

it('does not initialize cards while Apple capability loads or is unavailable', () => {
  mockPaymentId = null; mockParams.method = 'APPLE_PAY'; mockCapabilities.isLoading = true;
  const view = render(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: undefined, method: 'APPLE_PAY' }));
  mockCapabilities.isLoading = false; view.rerender(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: undefined, method: 'APPLE_PAY' }));
  fireEvent.press(view.getByText('nativePayment.useCard'));
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 'client', method: 'ONLINE_CARD' }));
});
it('offers explicit retry after authoritative failure', () => {
  mockPhase = 'failed'; const view = render(<NativeCheckout />);
  fireEvent.press(view.getByText('nativePayment.retry'));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});

it('returns a confirmed package with only its matching client-owned frozen selection', async () => {
  mockParams = { invoiceId: 'invoice', purchaseId: 'purchase' }; mockPhase = 'completed';
  jest.mocked(getPendingPackagePurchase).mockResolvedValue({ clientId: 'client', purchaseId: 'purchase', packageId: 'offer', familyId: 'family', branchId: 'branch' });
  render(<NativeCheckout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/packages/return', params: { purchaseId: 'purchase', clientId: 'client', origin: 'native', packageId: 'offer', familyId: 'family', branchId: 'branch' } }));
  expect(getPendingPackagePurchase).toHaveBeenCalledWith('client');
});
it('does not copy another account pending package identity into the return route', async () => {
  mockParams = { invoiceId: 'invoice', purchaseId: 'purchase' }; mockPhase = 'completed';
  jest.mocked(getPendingPackagePurchase).mockResolvedValue({ clientId: 'other', purchaseId: 'purchase', packageId: 'private-offer', familyId: 'family', branchId: 'branch' });
  render(<NativeCheckout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/packages/return', params: { purchaseId: 'purchase', clientId: 'client', origin: 'native' } }));
});
it('keeps native failures in the native flow without opening hosted checkout', () => {
  mockPhase = 'error'; const view = render(<NativeCheckout />);
  fireEvent.press(view.getByText('nativePayment.resume'));
  expect(mockRetry).toHaveBeenCalled(); expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
});

it('keeps checkout content below the notch and above the home indicator', () => {
  const view = render(<NativeCheckout />);
  const scroll = view.UNSAFE_getByType(ScrollView);
  const style = StyleSheet.flatten(scroll.props.contentContainerStyle);
  expect(style.paddingTop).toBe(83);
  expect(style.paddingBottom).toBe(58);
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
});

it('preserves the mounted bank form during checking, pending and transient errors', () => {
  mockConfig = {}; mockPhase = 'ready';
  const view = render(<NativeCheckout />);
  expect(mockMount).toHaveBeenCalledTimes(1);
  for (const phase of ['checking', 'pending', 'error']) {
    mockPhase = phase; view.rerender(<NativeCheckout />);
    expect(mockMount).toHaveBeenCalledTimes(1); expect(mockUnmount).not.toHaveBeenCalled();
  }
  mockPhase = 'failed'; mockConfig = null; view.rerender(<NativeCheckout />);
  expect(mockUnmount).toHaveBeenCalledTimes(1);
});

it.each<Record<string, string>>([{ invoiceId: 'invoice', purchaseId: 'purchase' }, { invoiceId: 'invoice', bookingId: 'booking' }])('offers Apple Pay or card for an eligible entry without an explicit method: %s', (params) => {
  mockParams = params; mockCapabilities.applePayAvailable = true; mockPhase = 'choosing';
  const view = render(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ method: undefined }));
  fireEvent.press(view.getByText('nativePayment.useApplePay'));
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'APPLE_PAY' }));
  mockPhase = 'ready'; mockConfig = {}; view.rerender(<NativeCheckout />);
  expect(view.queryByText('nativePayment.useCard')).toBeNull();
  expect(view.queryByText('nativePayment.useApplePay')).toBeNull();
});
it('defaults unspecified methods to cards when Apple Pay is unavailable', () => {
  const view = render(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'ONLINE_CARD' }));
  expect(view.queryByText('nativePayment.useApplePay')).toBeNull();
});
it('resets the selected method when the account changes', () => {
  mockCapabilities.applePayAvailable = true; mockPhase = 'choosing';
  const view = render(<NativeCheckout />);
  fireEvent.press(view.getByText('nativePayment.useApplePay'));
  mockClientId = 'other'; view.rerender(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 'other', method: undefined }));
});
it.each(['BOOKING_EXPIRED', 'BOOKING_CLOSED', 'INVOICE_CLOSED'])('shows terminal unavailable reason %s and only back navigation', (reason) => {
  mockPhase = 'unavailable'; mockUnavailableReason = reason; mockCanResume = false;
  const view = render(<NativeCheckout />);
  expect(view.getByText('nativePayment.' + reason)).toBeTruthy();
  expect(view.queryByText('nativePayment.checkAgain')).toBeNull(); expect(view.queryByText('nativePayment.resume')).toBeNull();
  expect(view.queryByText('nativePayment.retry')).toBeNull(); expect(view.getByText('nativePayment.back')).toBeTruthy();
});

it('retains the active card method if Apple Pay capability refreshes during a bank challenge', () => {
  mockPhase = 'ready'; mockConfig = {};
  const view = render(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'ONLINE_CARD' }));
  mockCapabilities.applePayAvailable = true; view.rerender(<NativeCheckout />);
  expect(mockCheckoutInput).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'ONLINE_CARD' }));
  expect(mockMount).toHaveBeenCalledTimes(1); expect(mockUnmount).not.toHaveBeenCalled();
});

it('returns to client home when checkout has no navigation history', () => {
  const screen = render(<NativeCheckout />);
  fireEvent.press(screen.getByRole('button', {name:'nativePayment.back'}));
  expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
});

it('keeps the card form and does not lock initialization after a definitive card rejection', () => {
  mockConfig = {}; mockPhase = 'ready';
  const view = render(<NativeCheckout />);
  act(() => mockFormProps?.onResult('rejected'));
  expect(mockPaymentResult).not.toHaveBeenCalled();
  expect(view.getByText('nativePayment.cardRejected')).toBeTruthy();
  act(() => mockFormProps?.onResult('submitted'));
  expect(mockPaymentResult).toHaveBeenCalledTimes(1);
});
