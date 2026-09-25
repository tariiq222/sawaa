import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockGetTodayBookings = jest.fn();
jest.mock('@/services/employee/bookings', () => ({
  employeeBookingsService: {
    getTodayBookings: (...args: unknown[]) => mockGetTodayBookings(...args),
  },
}));

jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: () => ({ firstName: 'Sara' }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => true,
  useReducedTransparency: () => false,
  useIncreasedContrast: () => false,
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['delay', 'duration', 'easing']) builder[method] = () => builder;
    return builder;
  };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: chain(),
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
  };
});

jest.mock('@/theme/sawaa', () => {
  const actual = jest.requireActual('@/theme/sawaa');
  const { View } = require('react-native');
  return {
    ...actual,
    AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    GlassSurface: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));

import i18n from '@/i18n';
import TodayScreen from '../today';

const confirmedBooking = {
  id: 'b-1',
  status: 'confirmed',
  type: 'individual',
  startTime: '10:00',
  endTime: '10:45',
  client: { firstName: 'Nora', lastName: 'A' },
};

async function renderInArabic() {
  await act(async () => {
    await i18n.changeLanguage('ar');
  });
  return render(<TodayScreen />);
}

describe('employee today screen load failures', () => {
  beforeEach(() => {
    mockGetTodayBookings.mockReset();
  });

  it('shows a retryable error instead of an empty day when the schedule fails to load', async () => {
    mockGetTodayBookings.mockRejectedValue(new Error('network down'));
    const view = await renderInArabic();

    await waitFor(() => expect(view.getByText(i18n.getFixedT('ar')('common.retry'))).toBeTruthy());
    expect(view.getByText(i18n.getFixedT('ar')('common.error'))).toBeTruthy();
    expect(view.getByText(i18n.getFixedT('ar')('doctor.scheduleLoadFailed'))).toBeTruthy();
    // The misleading "no appointments today" copy must not be shown.
    expect(view.queryByText(i18n.getFixedT('ar')('doctor.noAppointmentsToday'))).toBeNull();
    // Failed counts must not read as a real zero.
    expect(view.queryByText('0')).toBeNull();
  });

  it('recovers the day when the retry succeeds', async () => {
    mockGetTodayBookings.mockRejectedValueOnce(new Error('network down'));
    const view = await renderInArabic();

    const retry = await waitFor(() => view.getByText(i18n.getFixedT('ar')('common.retry')));
    mockGetTodayBookings.mockResolvedValue({ data: { items: [confirmedBooking] } });

    fireEvent.press(retry);

    await waitFor(() => expect(view.getByText('Nora A')).toBeTruthy());
    expect(view.queryByText(i18n.getFixedT('ar')('common.retry'))).toBeNull();
    expect(view.queryByText(i18n.getFixedT('ar')('doctor.scheduleLoadFailed'))).toBeNull();
  });

  it('still shows the plain empty day when the load succeeds with no appointments', async () => {
    mockGetTodayBookings.mockResolvedValue({ data: { items: [] } });
    const view = await renderInArabic();

    await waitFor(() => expect(view.getByText(i18n.getFixedT('ar')('doctor.noAppointmentsToday'))).toBeTruthy());
    expect(view.getByText(i18n.getFixedT('ar')('doctor.noAppointmentsHint'))).toBeTruthy();
    expect(view.queryByText(i18n.getFixedT('ar')('common.retry'))).toBeNull();
  });

  it('reloads the day on pull-to-refresh after a failure', async () => {
    mockGetTodayBookings.mockRejectedValueOnce(new Error('network down'));
    const view = await renderInArabic();
    await waitFor(() => expect(view.getByText(i18n.getFixedT('ar')('common.retry'))).toBeTruthy());

    mockGetTodayBookings.mockResolvedValue({ data: { items: [confirmedBooking] } });
    const list = view.UNSAFE_getByType(FlatList);
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(view.getByText('Nora A')).toBeTruthy());
    expect(view.queryByText(i18n.getFixedT('ar')('common.error'))).toBeNull();
  });
});
