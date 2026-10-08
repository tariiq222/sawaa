import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  // A stale price in the route must not be what gets sent.
  useLocalSearchParams: () => ({ invoiceId: 'inv-1', bookingId: 'book-1', amount: '99999' }),
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));

let mockInvoice: { data?: unknown; isLoading: boolean; isError: boolean; refetch: jest.Mock } = {
  data: undefined, isLoading: false, isError: false, refetch: jest.fn(),
};
let mockSettingsError = false;
const mockSettingsRefetch = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useBankTransferSettings: () => ({
    isError: mockSettingsError, refetch: mockSettingsRefetch,
    isLoading: false,
    data: { enabled: true, accounts: [{ id: 'acc-1', bankName: 'Bank', iban: 'SA00', accountName: 'Sawa' }] },
  }),
  useClientInvoice: () => mockInvoice,
}));

const mockUpload = jest.fn();
jest.mock('@/services/client', () => ({
  clientPaymentsService: { uploadBankTransfer: (...args: unknown[]) => mockUpload(...args) },
}));
jest.mock('@/lib/currency-display', () => ({
  formatCurrencyAmount: (halalas: number) => `SAR:${halalas}`,
}));
jest.mock('@/components/features/booking/BankTransferAccountDetails', () => {
  const { Text } = require('react-native');
  return { BankTransferAccountDetails: ({ amountLabel }: { amountLabel: string }) => <Text testID="amount">{amountLabel}</Text> };
});
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///r.png', mimeType: 'image/png', fileName: 'r.png' }] }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 's', Error: 'e' },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View }, FadeInDown: animation, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: import('i18next').TOptions) => require('@/test-utils/translation').translatedTestMessage(key, 'en', options) }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: require('react-native').View,
}));
jest.mock('@/theme/components/Glass', () => {
  const { Pressable } = require('react-native');
  return { Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => <Pressable onPress={onPress}>{children}</Pressable> };
});
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/ui/EmptyState', () => {
  const { Text } = require('react-native');
  return { EmptyState: ({ title }: { title: string }) => <Text testID="empty">{title}</Text> };
});

import BankTransferScreen from '../bank-transfer';

describe('bank transfer screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsError = false;
    mockUpload.mockResolvedValue({ id: 'pay-1' });
    mockInvoice = {
      data: {
        id: 'inv-1',
        status: 'ISSUED',
        total: '18000.00',
        payments: [{ id: 'p-1', status: 'FAILED', amount: '18000' }, { id: 'p-2', status: 'PENDING', amount: '3000' }],
      },
      isLoading: false, isError: false, refetch: jest.fn(),
    };
  });

  it('retries settings errors rather than displaying unavailable bank transfer', () => {
    mockSettingsError = true;
    const screen = render(<BankTransferScreen />);
    fireEvent.press(screen.getByText('Try again'));
    expect(mockSettingsRefetch).toHaveBeenCalled();
    expect(screen.queryByText('Bank transfer is currently unavailable. Please choose another payment method.')).toBeNull();
    expect(screen.queryByTestId('amount')).toBeNull();
  });

  it('shows and uploads what the invoice still owes, not the route price', async () => {
    const screen = render(<BankTransferScreen />);
    expect(screen.getByTestId('amount').props.children).toBe('SAR:15000');

    fireEvent.press(screen.getByText('Tap to upload receipt image'));
    await waitFor(() => expect(screen.getByText('Receipt selected')).toBeTruthy());
    fireEvent.press(screen.getByText('Send for review'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(mockUpload).toHaveBeenCalledWith('inv-1', 15000, expect.objectContaining({ uri: 'file:///r.png' }));
  });

  it('exposes upload progress and blocks repeated review submission', async () => {
    mockUpload.mockReturnValueOnce(new Promise(() => {}));
    const screen = render(<BankTransferScreen />);
    fireEvent.press(screen.getByText('Tap to upload receipt image'));
    await waitFor(() => expect(screen.getByText('Receipt selected')).toBeTruthy());
    const button = screen.getByRole('button', { name: 'Send for review' });
    act(() => { fireEvent.press(button); fireEvent.press(button); });
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Sending…' }).props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });

  it('tells the client nothing is owed instead of uploading for a settled invoice', () => {
    mockInvoice = { ...mockInvoice, data: { id: 'inv-1', status: 'PAID', total: '18000', payments: [{ id: 'p-1', status: 'COMPLETED', amount: '18000' }] } };
    const screen = render(<BankTransferScreen />);
    expect(screen.getByTestId('empty').props.children).toBe('Nothing is owed on this invoice.');
    expect(screen.queryByTestId('amount')).toBeNull();
  });

  it('shows an error state when the invoice cannot be read', () => {
    mockInvoice = { ...mockInvoice, data: undefined, isError: true };
    const screen = render(<BankTransferScreen />);
    expect(screen.getByTestId('empty').props.children).toBe('An error occurred');
  });
});

it('blocks repeated upload while the receipt is pending and announces busy state', async () => {
  jest.clearAllMocks();
  mockSettingsError = false;
  mockInvoice = { data: { id: 'inv-1', status: 'ISSUED', total: '15000', payments: [] }, isLoading: false, isError: false, refetch: jest.fn() };
  let resolveUpload: ((result: { id: string }) => void) | undefined;
  mockUpload.mockReset().mockImplementation(() => new Promise<{ id: string }>((resolve) => { resolveUpload = resolve; }));
  const screen = render(<BankTransferScreen />);
  fireEvent.press(screen.getByText('Tap to upload receipt image'));
  await waitFor(() => expect(screen.getByText('Receipt selected')).toBeTruthy());
  // Selecting a local file does not submit or confirm a receipt.
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  const button = screen.getByRole('button', { name: 'Sending…' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  fireEvent.press(button);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { resolveUpload?.({ id: 'pay-1' }); });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { bookingId: 'book-1', invoiceId: 'inv-1', paymentId: 'pay-1' } });
});
