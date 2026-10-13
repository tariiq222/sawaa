import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockRunCheckout = jest.fn();
const mockGetPending = jest.fn<Promise<unknown>, []>(async () => null);
let mockFocusCleanups: (() => void)[] = [];

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({ familyId: 'family-1', optionId: 'package-1' }),
    useFocusEffect: (callback: () => void | (() => void)) => ReactActual.useEffect(() => {
      const cleanup = callback();
      if (typeof cleanup === 'function') mockFocusCleanups.push(cleanup);
      return cleanup;
    }, [callback]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: 'test-token', user: { id: 'client-1' } } }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/theme/sawaa/PrimaryButton', () => ({
  PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>{label}</Text></Pressable>;
  },
}));
jest.mock('@/components/ui/FloatingCta', () => ({ FloatingCta: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/features/booking/BookingStepHeader', () => ({ BookingStepHeader: () => null }));
jest.mock('@/components/ui/SectionHeader', () => ({ SectionHeader: () => null }));
jest.mock('@/components/features/packages/PackageBranchPicker', () => ({ PackageBranchPicker: () => null }));
jest.mock('@/hooks/queries', () => ({
  usePackageFamily: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    data: {
      id: 'family-1',
      isStandalone: false,
      nameAr: 'باقة',
      nameEn: 'Package',
      descriptionAr: '',
      descriptionEn: '',
      options: [{ id: 'package-1', nameAr: 'خيار', nameEn: 'Option', sessionCount: 4, price: { finalPrice: 10000 }, groups: [] }],
    },
  }),
  usePublicBranches: () => ({ data: [{ id: 'branch-1' }], isFetching: false, isError: false, refetch: jest.fn() }),
  useInitPackagePurchase: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/services/client/packages', () => ({ getPendingPackagePurchase: () => mockGetPending() }));
jest.mock('@/lib/package-checkout', () => ({ runPackageCheckout: (...args: unknown[]) => mockRunCheckout(...args) }));

import PackageConfirmScreen from '../confirm';

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCleanups = [];
  mockGetPending.mockResolvedValue(null);
});

it('navigates to native checkout when the purchase resolves while the screen is active', async () => {
  mockRunCheckout.mockResolvedValue({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' });
  const screen = render(<PackageConfirmScreen />);

  await act(async () => { fireEvent.press(screen.getByText('packages.purchase')); });

  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(client)/payments/native-checkout',
    params: { purchaseId: 'purchase-1', invoiceId: 'invoice-1' },
  });
});

it('does not navigate when the screen is left before the purchase resolves', async () => {
  let resolveCheckout: (value: { purchaseId: string; invoiceId: string }) => void = () => undefined;
  mockRunCheckout.mockReturnValue(new Promise((resolve) => { resolveCheckout = resolve; }));
  const screen = render(<PackageConfirmScreen />);

  await act(async () => { fireEvent.press(screen.getByText('packages.purchase')); });
  screen.unmount();
  await act(async () => { resolveCheckout({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' }); });

  expect(mockReplace).not.toHaveBeenCalled();
});

it('does not navigate when the mounted screen blurs before the purchase resolves', async () => {
  let resolveCheckout: (value: { purchaseId: string; invoiceId: string }) => void = () => undefined;
  mockRunCheckout.mockReturnValue(new Promise((resolve) => { resolveCheckout = resolve; }));
  const screen = render(<PackageConfirmScreen />);

  await act(async () => { fireEvent.press(screen.getByText('packages.purchase')); });
  act(() => { mockFocusCleanups.forEach((cleanup) => cleanup()); });
  await act(async () => { resolveCheckout({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' }); });

  expect(mockReplace).not.toHaveBeenCalled();
});

it.each(['blur', 'unmount'])('does not recover a pending purchase after %s', async (departure) => {
  let finishPending: (value: unknown) => void = () => undefined;
  mockGetPending.mockReturnValue(new Promise((resolve) => { finishPending = resolve; }));
  const screen = render(<PackageConfirmScreen />);

  if (departure === 'unmount') screen.unmount();
  else act(() => { mockFocusCleanups.forEach((cleanup) => cleanup()); });
  await act(async () => {
    finishPending({ clientId: 'client-1', purchaseId: `recovery-${departure}`, packageId: 'package-1', familyId: 'family-1', branchId: 'branch-1', invoiceId: 'invoice-1' });
  });

  expect(mockReplace).not.toHaveBeenCalled();
});
