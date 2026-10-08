import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
const mockBook = jest.fn();
const mockBranches = jest.fn();
const mockRefetch = jest.fn();
const mockReplace = jest.fn();
const mockSlotA = { startTime: new Date(2026, 9, 2, 9).toISOString(), endTime: new Date(2026, 9, 2, 10).toISOString() };
const mockSlotB = { startTime: new Date(2026, 9, 2, 14).toISOString(), endTime: new Date(2026, 9, 2, 15).toISOString() };
let mockSlotsA = [mockSlotA];
let mockSlotsError = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ creditId: 'credit-1', serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1', deliveryType: 'IN_PERSON' }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: import('i18next').TOptions) => key.startsWith('booking.') || key === 'common.retry' ? require('@/test-utils/translation').translatedTestMessage(key, 'en', options) : key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress}>{children}</Pressable>;
} }));
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('react-native-reanimated', () => {
  const animation = { delay: () => animation, duration: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('@/services/client/branches', () => ({ publicBranchesService: { list: () => mockBranches() } }));
jest.mock('@/hooks/queries', () => ({
  usePublicBranches: (...args: unknown[]) => jest.requireActual('@/hooks/queries/usePublicBranches').usePublicBranches(...args),
  useBookPackageCredit: () => ({ mutateAsync: mockBook, isPending: false }),
  useSlots: ({ branchId }: { branchId?: string }) => ({ data: branchId === 'branch-b' ? [mockSlotB] : mockSlotsA, isLoading: false, isError: mockSlotsError, refetch: mockRefetch }),
}));

import PackageBookScreen from '../book';

let queryClient: QueryClient;
function wrapper({ children }: React.PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>; }
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.clearAllMocks();
  mockSlotsA = [mockSlotA];
  mockSlotsError = false;
  mockBranches.mockResolvedValue([
    { id: 'branch-a', nameAr: 'أ', nameEn: 'Branch A', city: null },
    { id: 'branch-b', nameAr: 'ب', nameEn: 'Branch B', city: null },
  ]);
  mockBook.mockResolvedValue({});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => { queryClient.clear(); jest.restoreAllMocks(); });

it('clears the selected time when switching branches and submits only the newly selected time', async () => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeEnabled();

  fireEvent.press(screen.getByText('Branch B'));
  expect(screen.getByLabelText('Time 2:00 PM').props.accessibilityState.selected).toBe(false);
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'packages.confirmBooking' }));
  expect(mockBook).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText('Time 2:00 PM'));
  fireEvent.press(screen.getByRole('button', { name: 'packages.confirmBooking' }));
  await waitFor(() => expect(mockBook).toHaveBeenCalledWith({
    creditId: 'credit-1', branchId: 'branch-b', scheduledAt: mockSlotB.startTime,
    serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1', deliveryType: 'IN_PERSON',
  }));
  expect(Alert.alert).toHaveBeenCalledWith('packages.bookingSuccess', 'packages.bookingSuccessDescription', expect.any(Array));
});

it('clears selection on day change', async () => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  fireEvent.press(screen.getByText(new Date(Date.now() + 86400000).getDate().toString()));
  expect(screen.getByLabelText('Time 9:00 AM').props.accessibilityState.selected).toBe(false);
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeDisabled();
});

it('does not select a different time at the same index after slots refresh', async () => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  mockSlotsA = [mockSlotB];
  screen.rerender(<PackageBookScreen />);
  expect(screen.getByLabelText('Time 2:00 PM').props.accessibilityState.selected).toBe(false);
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeDisabled();
  mockSlotsA = [mockSlotA];
  screen.rerender(<PackageBookScreen />);
  expect(screen.getByLabelText('Time 9:00 AM').props.accessibilityState.selected).toBe(false);
});

it('preserves the explicitly selected time when refreshed slots are reordered', async () => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  mockSlotsA = [mockSlotB, { ...mockSlotA }];
  screen.rerender(<PackageBookScreen />);
  expect(screen.getByLabelText('Time 9:00 AM').props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Time 2:00 PM').props.accessibilityState.selected).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'packages.confirmBooking' }));
  await waitFor(() => expect(mockBook).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: mockSlotA.startTime })));
});

it('preserves branch and slots retries and reports a failed booking', async () => {
  mockBranches.mockRejectedValueOnce(new Error('offline'));
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('packages.branchError');
  fireEvent.press(screen.getByText('packages.retry'));
  await screen.findByText('Branch A');
  expect(mockBranches).toHaveBeenCalledTimes(2);

  mockSlotsError = true;
  screen.rerender(<PackageBookScreen />);
  expect(screen.getByText('packages.slotsError')).toBeOnTheScreen();
  fireEvent.press(screen.getByText('Retry'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  mockSlotsError = false;
  screen.rerender(<PackageBookScreen />);
  mockBook.mockRejectedValueOnce(new Error('unavailable'));
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  fireEvent.press(screen.getByRole('button', { name: 'packages.confirmBooking' }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('packages.errorTitle', 'packages.bookingError'));
});

it.each([
  { available: true, refreshedSlots: [mockSlotA] },
  { available: false, refreshedSlots: [mockSlotB] },
])('blocks cached slot booking during an error and recovers only an available identity ($available)', async ({ available, refreshedSlots }) => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  fireEvent.press(screen.getByLabelText('Time 9:00 AM'));
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeEnabled();

  mockSlotsError = true;
  screen.rerender(<PackageBookScreen />);
  expect(screen.queryByLabelText('Time 9:00 AM')).toBeNull();
  expect(screen.getByRole('button', { name: 'packages.confirmBooking' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'packages.confirmBooking' }));
  expect(mockBook).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Retry'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);

  mockSlotsError = false;
  mockSlotsA = refreshedSlots;
  screen.rerender(<PackageBookScreen />);
  const confirm = screen.getByRole('button', { name: 'packages.confirmBooking' });
  if (available) {
    expect(screen.getByLabelText('Time 9:00 AM').props.accessibilityState.selected).toBe(true);
    expect(confirm).toBeEnabled();
    fireEvent.press(confirm);
    await waitFor(() => expect(mockBook).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: mockSlotA.startTime })));
  } else {
    expect(screen.getByLabelText('Time 2:00 PM').props.accessibilityState.selected).toBe(false);
    expect(confirm).toBeDisabled();
    fireEvent.press(confirm);
    expect(mockBook).not.toHaveBeenCalled();
  }
});

it('omits slot entering callbacks when reduced motion is enabled', async () => {
  const screen = render(<PackageBookScreen />, { wrapper });
  await screen.findByText('Branch A');
  expect(screen.UNSAFE_getAllByType(View).filter((view) => view.props.entering !== undefined)).toHaveLength(0);
});
