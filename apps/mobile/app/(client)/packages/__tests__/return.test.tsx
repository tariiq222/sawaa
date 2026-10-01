import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { PACKAGE_PAYMENT_MAX_POLLS, PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE } from '@/lib/package-utils';

type Purchase = { status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'REFUNDED' } | undefined;
const mockPurchase: { data: Purchase; dataUpdatedAt: number; isLoading: boolean; isError: boolean } = {
  data: undefined,
  dataUpdatedAt: 0,
  isLoading: false,
  isError: false,
};
let mockParams: Record<string, string> = {};
const mockRefetch = jest.fn(async () => undefined);
const mockReplace = jest.fn();
const mockUsePackagePurchase = jest.fn();
const mockClearPending = jest.fn(async () => undefined);
const mockClearAttemptKey = jest.fn(async (..._args: unknown[]) => undefined);
const mockRunCheckout = jest.fn();
const mockMutateAsync = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useRouter: () => ({ replace: mockReplace }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (callback: () => void) => ReactActual.useEffect(callback, [callback]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: { id: 'client-1' } } }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/queries', () => ({
  usePackagePurchase: (id: string | undefined, options: { poll?: boolean }) => {
    mockUsePackagePurchase(id, options);
    return { ...mockPurchase, refetch: mockRefetch };
  },
  useInitPackagePurchase: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));
jest.mock('@/services/client/packages', () => ({
  clearPendingPackagePurchase: () => mockClearPending(),
  clearPackagePurchaseAttemptKey: (...args: unknown[]) => mockClearAttemptKey(...args),
}));
jest.mock('@/lib/package-checkout', () => ({ runPackageCheckout: (...args: unknown[]) => mockRunCheckout(...args) }));

import PackagePaymentReturnScreen from '../return';

const target = { purchaseId: 'purchase-1', clientId: 'client-1', packageId: 'package-1', familyId: 'family-1', branchId: 'branch-1' };

function lastPollOption() {
  return mockUsePackagePurchase.mock.calls[mockUsePackagePurchase.mock.calls.length - 1][1];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { ...target };
  mockPurchase.data = undefined;
  mockPurchase.dataUpdatedAt = 0;
  mockPurchase.isLoading = false;
  mockPurchase.isError = false;
});

it('shows a failed state and clears the saved pending purchase when the gateway reports a decline', async () => {
  mockParams = { ...target, status: 'failed', message: 'Declined' };
  mockPurchase.data = { status: 'PENDING' };
  mockPurchase.dataUpdatedAt = 1;

  const screen = render(<PackagePaymentReturnScreen />);

  expect(screen.getByText('packages.paymentFailed')).toBeTruthy();
  expect(screen.getByText('packages.tryPaymentAgain')).toBeTruthy();
  await waitFor(() => expect(mockClearPending).toHaveBeenCalled());
  // The attempt key is kept so a retry resumes the same purchase.
  expect(mockClearAttemptKey).not.toHaveBeenCalled();
  expect(lastPollOption()).toEqual({ poll: false });
});

it('stops polling after a bounded number of still-pending reads and offers check-again and back', async () => {
  mockPurchase.data = { status: 'PENDING' };
  mockPurchase.dataUpdatedAt = 1;
  const screen = render(<PackagePaymentReturnScreen />);
  expect(screen.getByText('packages.paymentPending')).toBeTruthy();
  expect(lastPollOption()).toEqual({ poll: true });

  for (let update = 2; update <= PACKAGE_PAYMENT_MAX_POLLS; update += 1) {
    mockPurchase.dataUpdatedAt = update;
    screen.rerender(<PackagePaymentReturnScreen />);
  }

  expect(screen.getByText('packages.paymentUnconfirmed')).toBeTruthy();
  expect(screen.getByText('packages.checkAgain')).toBeTruthy();
  expect(screen.getByText('packages.backToBalance')).toBeTruthy();
  expect(lastPollOption()).toEqual({ poll: false });
  await waitFor(() => expect(mockClearPending).toHaveBeenCalled());

  fireEvent.press(screen.getByText('packages.backToBalance'));
  expect(mockReplace).toHaveBeenCalledWith('/(client)/packages/purchases');
  // Never sends the client back to the package screen on its own.
  expect(mockReplace).toHaveBeenCalledTimes(1);
});

it('gives up sooner once the client closed the payment page', () => {
  mockParams = { ...target, signal: 'closed' };
  mockPurchase.data = { status: 'PENDING' };
  mockPurchase.dataUpdatedAt = 1;
  const screen = render(<PackagePaymentReturnScreen />);
  for (let update = 2; update <= PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE; update += 1) {
    mockPurchase.dataUpdatedAt = update;
    screen.rerender(<PackagePaymentReturnScreen />);
  }
  expect(screen.getByText('packages.paymentUnconfirmed')).toBeTruthy();
});

it('shows success and clears both the attempt key and the pending record once the purchase is active', async () => {
  mockPurchase.data = { status: 'ACTIVE' };
  mockPurchase.dataUpdatedAt = 1;
  const screen = render(<PackagePaymentReturnScreen />);
  expect(screen.getByText('packages.paymentSuccess')).toBeTruthy();
  await waitFor(() => expect(mockClearPending).toHaveBeenCalled());
  expect(mockClearAttemptKey).toHaveBeenCalledWith('client-1', 'package-1', 'family-1', 'branch-1');
});

it('retries the same checkout and resumes checking', async () => {
  mockParams = { ...target, status: 'failed' };
  mockPurchase.data = { status: 'PENDING' };
  mockPurchase.dataUpdatedAt = 1;
  mockRunCheckout.mockResolvedValue({ purchaseId: 'purchase-1', signal: 'unknown' });
  const screen = render(<PackagePaymentReturnScreen />);

  await act(async () => {
    fireEvent.press(screen.getByText('packages.tryPaymentAgain'));
  });

  expect(mockRunCheckout).toHaveBeenCalledWith(mockMutateAsync, {
    clientId: 'client-1', packageId: 'package-1', familyId: 'family-1', branchId: 'branch-1',
  });
  expect(screen.getByText('packages.paymentPending')).toBeTruthy();
  expect(lastPollOption()).toEqual({ poll: true });
});
