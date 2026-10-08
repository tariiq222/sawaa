import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ ink: { 500: 'gray' }, teal: { 600: 'teal' } }) }));
jest.mock('@/theme/sawaa', () => ({ PrimaryButton: 'PrimaryButton', sawaaSpacing: { sm: 8 } }));
jest.mock('@/components/ui/SecondaryButton', () => ({ SecondaryButton: 'SecondaryButton' }));
jest.mock('@/components/ui/EmptyState', () => ({ EmptyState: 'EmptyState' }));
jest.mock('@/components/ui/SectionHeader', () => ({ SectionHeader: 'SectionHeader' }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'font' }));
jest.mock('@/features/payments/DeferredApplePayButton', () => ({ DeferredApplePayButton: 'DeferredApplePayButton' }));

import { BookingPaymentActions } from '../BookingPaymentActions';

const apple = { phase: null, preparing: false, locked: false, error: null, unavailableReason: undefined, canRetryInit: true,
  prepare: jest.fn(), reconcile: jest.fn(), retryInitialization: jest.fn(), cancel: jest.fn(), handoff: jest.fn() };
const payment = (submitting: boolean) => ({ submitting, canStart: !submitting, methodsLoading: false, methodsError: false,
  availableMethods: ['card', 'at_center'], retryMethods: jest.fn(), pay: jest.fn() });
const renderActions = (submitting: boolean, overrides = {}) => render(
  <BookingPaymentActions payment={payment(submitting) as never} apple={{ ...apple, ...overrides } as never} />,
);

it('shows progress while a non-Wallet action is submitting', () => {
  expect(renderActions(true).UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  expect(renderActions(false).UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
});

it('offers retry only when initialization can actually be retried', () => {
  const blocked = renderActions(false, { phase: 'error', error: 'nativePayment.verificationError', canRetryInit: false });
  expect(JSON.stringify(blocked.toJSON())).not.toContain('nativePayment.retry');
  const allowed = renderActions(false, { phase: 'error', error: 'nativePayment.verificationError', canRetryInit: true });
  expect(JSON.stringify(allowed.toJSON())).toContain('nativePayment.retry');
});

it('offers Check again only when a payment identity exists', () => {
  const noIdentity = renderActions(false, { phase: 'error', error: 'nativePayment.verificationError', canRetryInit: true, hasPaymentIdentity: false });
  expect(JSON.stringify(noIdentity.toJSON())).not.toContain('nativePayment.checkAgain');
  const withIdentity = renderActions(false, { phase: 'error', error: 'nativePayment.verificationError', canRetryInit: true, hasPaymentIdentity: true });
  expect(JSON.stringify(withIdentity.toJSON())).toContain('nativePayment.checkAgain');
  const pending = renderActions(false, { phase: 'pending', hasPaymentIdentity: true });
  expect(JSON.stringify(pending.toJSON())).toContain('nativePayment.checkAgain');
});
