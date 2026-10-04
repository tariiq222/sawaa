import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
    durationOptionId: '', durationMins: '45', deliveryType: 'in_person',
  }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ ink: { 900: '#111', 500: '#555' } }) }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    AquaBackground: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    sawaaSpacing: { xs: 4, md: 12, lg: 16, xl: 20 },
    sawaaType: { heading: { fontSize: 24, lineHeight: 30 }, caption: { fontSize: 12, lineHeight: 16 }, body: { fontSize: 14, lineHeight: 20 }, micro: { fontSize: 11, lineHeight: 14 } },
  };
});
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => false }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/lib/navigation', () => ({ goBackOrHome: jest.fn() }));
jest.mock('@/components/features/booking/BookingStepHeader', () => ({ BookingStepHeader: () => null }));
jest.mock('@/components/features/booking/BookingCta', () => ({ BookingCta: () => null }));
jest.mock('@/components/features/booking/DaySelector', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return { DaySelector: ({ dayIdx, availabilityByDate }: { dayIdx: number | null; availabilityByDate: Record<string, boolean> | null }) =>
    <Text testID="day-state">{JSON.stringify({ dayIdx, availabilityByDate })}</Text> };
});
jest.mock('@/components/features/booking/TimeSlotsGrid', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return { TimeSlotsGrid: () => <Text testID="slot-grid">Slots</Text> };
});
jest.mock('@/components/ui/EmptyState', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return { EmptyState: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/services/client/employees', () => ({ publicEmployeesService: { getAvailableDays: jest.fn(), getSlots: jest.fn() } }));
jest.mock('@/services/branches', () => ({ branchesService: { getAll: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

import BookingScheduleScreen from '../schedule';
import { publicEmployeesService } from '@/services/client/employees';
import { branchesService } from '@/services/branches';

const mockGetAvailableDays = publicEmployeesService.getAvailableDays as jest.Mock;
const mockGetSlots = publicEmployeesService.getSlots as jest.Mock;
const mockGetBranches = branchesService.getAll as jest.Mock;

function localDate(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBranches.mockResolvedValue([{ id: 'branch-1', isMain: true }]);
  mockGetSlots.mockResolvedValue([]);
});

it('leaves all days inactive and hides times when this booking has no openings', async () => {
  mockGetAvailableDays.mockResolvedValue([{ date: localDate(0), hasSlots: false }, { date: localDate(1), hasSlots: false }]);
  const screen = render(<BookingScheduleScreen />);

  await waitFor(() => expect(mockGetAvailableDays).toHaveBeenCalled());
  await waitFor(() => expect(JSON.parse(screen.getByTestId('day-state').props.children).dayIdx).toBeNull());
  expect(screen.queryByTestId('slot-grid')).toBeNull();
  expect(mockGetSlots).not.toHaveBeenCalled();
});

it('selects the first day with openings before loading its times', async () => {
  mockGetAvailableDays.mockResolvedValue([{ date: localDate(0), hasSlots: false }, { date: localDate(1), hasSlots: true }]);
  mockGetSlots.mockResolvedValueOnce([{ startTime: `${localDate(1)}T09:00:00.000Z`, endTime: `${localDate(1)}T09:45:00.000Z` }]);
  const screen = render(<BookingScheduleScreen />);

  await waitFor(() => expect(mockGetSlots).toHaveBeenCalledWith(expect.objectContaining({ date: localDate(1) })));
  expect(JSON.parse(screen.getByTestId('day-state').props.children).dayIdx).toBe(1);
  expect(screen.getByTestId('slot-grid')).toBeTruthy();
});

it('moves to another available day when the selected day loses its last slot', async () => {
  mockGetAvailableDays.mockResolvedValue([
    { date: localDate(0), hasSlots: true },
    { date: localDate(1), hasSlots: true },
  ]);
  mockGetSlots
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ startTime: `${localDate(1)}T09:00:00.000Z`, endTime: `${localDate(1)}T09:45:00.000Z` }]);
  const screen = render(<BookingScheduleScreen />);

  await waitFor(() => expect(JSON.parse(screen.getByTestId('day-state').props.children).dayIdx).toBe(1));
  expect(JSON.parse(screen.getByTestId('day-state').props.children).availabilityByDate[localDate(0)]).toBe(false);
  expect(screen.getByTestId('slot-grid')).toBeTruthy();
});

it('shows a request error instead of treating a failed day probe as no availability', async () => {
  mockGetAvailableDays.mockRejectedValue(new Error('HTTP 500'));
  const screen = render(<BookingScheduleScreen />);

  await waitFor(() => expect(screen.getByText('Could not check available days')).toBeTruthy());
  expect(screen.queryByText('No openings for this booking in the next 30 days')).toBeNull();
  expect(screen.queryByTestId('slot-grid')).toBeNull();
});
