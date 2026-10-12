import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { decodeRedirect } from '@/lib/navigation';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCheckout = jest.fn();
const mockGetPending = jest.fn();
let mockParams: Record<string, string | undefined> = {};
let mockToken: string | null = null;
let mockBranches: { id: string; nameAr: string; nameEn: string; city: null; isMain?: boolean }[] | undefined = [];
let mockVatRate = 0;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockToken, user: mockToken ? { id: 'client-1' } : null } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/lib/package-checkout', () => ({ runPackageCheckout: (...args: unknown[]) => mockCheckout(...args) }));
jest.mock('@/services/client/packages', () => ({ getPendingPackagePurchase: (...args: unknown[]) => mockGetPending(...args) }));
jest.mock('@/hooks/queries', () => ({
  usePublicBranches: () => ({ data: mockBranches, isFetching: false, isError: false, refetch: jest.fn() }),
  useInitPackagePurchase: () => ({ mutateAsync: jest.fn(), isPending: false }),
  usePackageFamily: () => ({
    data: {
      id: 'family-1', nameAr: 'باقة', nameEn: 'Family', isStandalone: false, vatRate: mockVatRate,
      options: [
        { id: 'opt-1', nameAr: 'أ', nameEn: 'Option A', sessionCount: 4, price: { finalPrice: 40000 } },
        { id: 'opt-2', nameAr: 'ب', nameEn: 'Option B', sessionCount: 8, price: { finalPrice: 70000 } },
      ],
    },
    isLoading: false, isError: false, isFetching: false, refetch: jest.fn(),
  }),
}));

import PackageConfirmScreen from '../confirm';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = null;
  mockVatRate = 0;
  mockBranches = [
    { id: 'branch-a', nameAr: 'أ', nameEn: 'Branch A', city: null },
    { id: 'branch-b', nameAr: 'ب', nameEn: 'Branch B', city: null, isMain: true },
  ];
  mockGetPending.mockResolvedValue(null);
});

describe('package confirm step', () => {
  beforeEach(() => { mockParams = { familyId: 'family-1', optionId: 'opt-2' }; });

  it('summarises the chosen option and total without asking for a branch', () => {
    mockVatRate = 0.15;
    const screen = render(<PackageConfirmScreen />);
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.queryByText('Branch B')).toBeNull();
    expect(screen.queryByText('packages.summaryBranch')).toBeNull();
    expect(screen.getByText('packages.sessionCount')).toBeTruthy();
    expect(screen.getByText('packages.summaryVat')).toBeTruthy();
    expect(screen.getByText('packages.summaryTotal')).toBeTruthy();
    expect(screen.getByText(/805/)).toBeTruthy();
  });

  it('sends a guest to login and back to this confirm step', () => {
    const screen = render(<PackageConfirmScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'booking.signInOrRegisterToContinue' }));
    const href = mockPush.mock.calls[0][0];
    expect(href.pathname).toBe('/(auth)/login');
    expect(decodeRedirect(href.params.redirect)).toEqual({
      pathname: '/(client)/packages/confirm',
      params: { familyId: 'family-1', optionId: 'opt-2' },
    });
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('uses the main branch for checkout and disables purchase while no branch is known', () => {
    mockToken = 'token';
    mockBranches = [];
    const screen = render(<PackageConfirmScreen />);
    expect(screen.getByRole('button', { name: 'packages.purchase' }).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('packages.branchUnavailable')).toBeTruthy();
  });

  it('starts checkout for a signed-in client and opens native checkout', async () => {
    mockToken = 'token';
    mockCheckout.mockResolvedValue({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' });
    const screen = render(<PackageConfirmScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'packages.purchase' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/payments/native-checkout',
      params: { purchaseId: 'purchase-1', invoiceId: 'invoice-1' },
    }));
    expect(mockCheckout).toHaveBeenCalledWith(expect.any(Function), {
      clientId: 'client-1', packageId: 'opt-2', familyId: 'family-1', branchId: 'branch-b',
    });
  });

  it('shows the purchase error alert when checkout fails', async () => {
    mockToken = 'token';
    mockCheckout.mockRejectedValue(new Error('boom'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<PackageConfirmScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'packages.purchase' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('packages.errorTitle', 'packages.purchaseError'));
    alert.mockRestore();
  });

  it('recovers a pending purchase of the chosen option for a signed-in client', async () => {
    mockToken = 'token';
    mockGetPending.mockResolvedValue({ purchaseId: 'p-9', clientId: 'client-1', packageId: 'opt-2', familyId: 'family-1', branchId: 'branch-b' });
    render(<PackageConfirmScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/packages/return',
      params: { purchaseId: 'p-9', clientId: 'client-1', packageId: 'opt-2', familyId: 'family-1', branchId: 'branch-b' },
    }));
  });

  it('does not read pending purchases for a guest', () => {
    render(<PackageConfirmScreen />);
    expect(mockGetPending).not.toHaveBeenCalled();
  });
});
