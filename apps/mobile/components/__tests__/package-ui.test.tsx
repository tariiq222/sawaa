import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: mockRTL, language: mockRTL ? 'ar' : 'en' }) }));
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Detail from '../../app/(client)/packages/[id]';
import Index from '../../app/(client)/packages/index';
import Purchases from '../../app/(client)/packages/purchases';
import Book from '../../app/(client)/packages/book';

const mockReplace = jest.fn();
const mockRunCheckout = jest.fn();
const mockMutateAsync = jest.fn();
let mockUser = { id: 'client' };
let mockBranches: { id: string; name: string }[] = [];
jest.mock('@/lib/package-checkout', () => ({ runPackageCheckout: (...args: unknown[]) => mockRunCheckout(...args) }));
const mockBack = jest.fn();
const mockRefetch = jest.fn();
let mockRTL = false;
let mockQuery = { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, refetch: mockRefetch };
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }), useLocalSearchParams: () => ({ id: 'family' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockRTL ? 'ar' : 'en', isRTL: mockRTL, row: mockRTL ? 'row-reverse' : 'row', textAlign: mockRTL ? 'right' : 'left' }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockUser }));
jest.mock('@/hooks/queries', () => ({
  usePackageFamily: () => mockQuery, usePackageFamilies: () => mockQuery, usePackagePurchases: () => mockQuery,
  useInitPackagePurchase: () => ({ isPending: false, mutateAsync: mockMutateAsync }), useBookPackageCredit: () => ({ isPending: false }), useSlots: () => ({ data: [] }),
}));
jest.mock('@/services/client', () => ({ publicBranchesService: { list: jest.fn(async () => mockBranches) } }));
jest.mock('@/services/client/packages', () => ({ getPendingPackagePurchase: jest.fn(async () => null) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, ...props }: React.PropsWithChildren<{ onPress?: () => void }>) =>
    require('react').createElement(require('react-native').Pressable, { onPress, ...props }, children),
}));
jest.mock('@/components/features/packages/PackageBranchPicker', () => ({ PackageBranchPicker: () => null }));
jest.mock('@/components/features/packages/PackageCreditCard', () => ({ PackageCreditCard: () => null }));
jest.mock('@/components/features/packages/PackageBookingAction', () => ({ PackageBookingAction: () => null }));
jest.mock('@/components/features/booking/DaySelector', () => ({ DaySelector: () => null }));
jest.mock('@/components/features/booking/TimeSlotsGrid', () => ({ TimeSlotsGrid: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRTL = false;
  mockUser = { id: 'client' };
  mockBranches = [];
  mockRunCheckout.mockReset();
  mockQuery = { isLoading: false, isError: false, isFetching: false, data: undefined, refetch: mockRefetch };
});

async function renderScreen(Component: React.ComponentType) {
  render(<Component />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'a11y.buttonBack' })).toBeTruthy());
}

it('shows loading without a premature details error', async () => {
  mockQuery.isLoading = true;
  await renderScreen(Detail);
  expect(screen.getByText('packages.loading')).toBeTruthy();
  expect(screen.queryByText('packages.error')).toBeNull();
});

it.each([['details', Detail], ['catalog', Index], ['balance', Purchases]] as const)('%s retries the failed read query', async (_name, Component) => {
  mockQuery.isError = true;
  await renderScreen(Component);
  expect(screen.getByText('packages.error')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it.each([['details', Detail], ['catalog', Index], ['balance', Purchases]] as const)('%s disables retry during an in-flight fetch', async (_name, Component) => {
  mockQuery.isError = true;
  mockQuery.isFetching = true;
  await renderScreen(Component);
  const retry = screen.getByRole('button', { name: 'common.retry' });
  expect(retry).toBeDisabled();
  fireEvent.press(retry);
  expect(mockRefetch).not.toHaveBeenCalled();
});

it('shows the details fallback after loading finishes without data', async () => {
  await renderScreen(Detail);
  expect(screen.queryByText('packages.loading')).toBeNull();
  expect(screen.getByText('packages.error')).toBeTruthy();
});

it.each([['details', Detail], ['catalog', Index], ['balance', Purchases], ['booking', Book]] as const)('%s uses the shared accessible 44pt back button', async (_name, Component) => {
  const view = render(<Component />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'a11y.buttonBack' })).toBeTruthy());
  const back = screen.getByRole('button', { name: 'a11y.buttonBack' });
  const style = StyleSheet.flatten(back.props.style);
  expect(style.width ?? style.minWidth).toBeGreaterThanOrEqual(44);
  expect(style.height ?? style.minHeight).toBeGreaterThanOrEqual(44);
  fireEvent.press(back);
  expect(mockBack).toHaveBeenCalledTimes(1);
  mockRTL = true;
  view.rerender(<Component />);
  expect(screen.getByRole('button', { name: 'a11y.buttonBack' })).toBeTruthy();
});

const vatFamily = (vatRate?: number) => ({
  id: 'family', nameAr: 'باقة', nameEn: 'Care package', descriptionAr: null, descriptionEn: null, isStandalone: false, imageUrl: null,
  ...(vatRate === undefined ? {} : { vatRate }),
  options: [{ id: 'opt', nameAr: 'خيار', nameEn: 'Option', sessionCount: 4, price: { finalPrice: 36000 }, displayGroups: [] }],
});

it.each([[undefined], [0]] as const)('details keeps the net price without a VAT note when vatRate is %s', async (vatRate) => {
  mockQuery.data = vatFamily(vatRate);
  await renderScreen(Detail);
  expect(screen.getByText('360.00 SAR')).toBeTruthy();
  expect(screen.queryByText(/packages\.vatIncluded/)).toBeNull();
});

it('details shows the VAT-inclusive price and a net + VAT breakdown when vatRate is above 0', async () => {
  mockQuery.data = vatFamily(0.15);
  await renderScreen(Detail);
  expect(screen.getByText('414.00 SAR')).toBeTruthy();
  expect(screen.queryByText('360.00 SAR')).toBeNull();
  expect(screen.getByText(/packages\.vatIncluded/)).toBeTruthy();
});

it('balance shows the VAT-inclusive charged total, falling back to amountPaid', async () => {
  const row = (id: string, extra: Record<string, number>) => ({
    id, status: 'ACTIVE', packageNameAr: id, packageNameEn: id, offerSnapshot: null, amountPaid: 36000, refundAmount: 0, credits: [], ...extra,
  });
  mockQuery.data = [row('with-vat', { vatAmount: 5400, totalCharged: 41400 }), row('legacy', {})];
  await renderScreen(Purchases);
  expect(screen.getByText('414.00 SAR')).toBeTruthy();
  expect(screen.getByText('360.00 SAR')).toBeTruthy();
});

it.each([true, false])('opens native checkout for standalone=%s and ignores duplicate taps', async (isStandalone) => {
  mockBranches = [{ id: 'branch-1', name: 'Branch' }];
  mockQuery.data = { ...vatFamily(), isStandalone };
  mockRunCheckout.mockResolvedValue({ purchaseId: 'purchase-1', invoiceId: 'invoice-1' });
  await renderScreen(Detail);
  await waitFor(() => expect(screen.getByRole('button', { name: 'packages.purchase' })).not.toBeDisabled());
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'packages.purchase' }));
    fireEvent.press(screen.getByRole('button', { name: 'packages.purchase' }));
  });
  expect(mockRunCheckout).toHaveBeenCalledTimes(1);
  expect(mockRunCheckout).toHaveBeenCalledWith(mockMutateAsync, { clientId: 'client', packageId: 'opt', familyId: isStandalone ? '' : 'family', branchId: 'branch-1' });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/payments/native-checkout', params: { purchaseId: 'purchase-1', invoiceId: 'invoice-1' } });
});

it('ignores an old account checkout completion after the account changes', async () => {
  mockBranches = [{ id: 'branch-1', name: 'Branch' }];
  mockQuery.data = vatFamily();
  let finish!: (value: { purchaseId: string; invoiceId: string }) => void;
  mockRunCheckout.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const view = render(<Detail />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'packages.purchase' })).not.toBeDisabled());
  fireEvent.press(screen.getByRole('button', { name: 'packages.purchase' }));
  mockUser = { id: 'other-client' };
  view.rerender(<Detail />);
  await act(async () => { finish({ purchaseId: 'old-purchase', invoiceId: 'old-invoice' }); });
  expect(mockReplace).not.toHaveBeenCalled();
});
