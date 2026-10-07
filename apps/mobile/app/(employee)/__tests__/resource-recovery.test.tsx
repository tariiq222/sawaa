import React from 'react';
import { Alert, Switch } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
let mockClientId = 'client-a';
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockClientId }),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  router: { back: () => mockBack() },
  Stack: { Screen: () => null },
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
  const chain: Record<string, unknown> = {};
  for (const method of ['delay', 'duration', 'easing']) chain[method] = () => chain;
  return {
    __esModule: true, default: { View }, FadeInDown: chain,
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value, withRepeat: (value: unknown) => value,
  };
});
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa'),
  AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));

import api from '@/services/api';
import i18n from '@/i18n';
import { buildDirState, DirContext } from '@/hooks/useDir';
import ClientsScreen from '../(tabs)/clients';
import ClientScreen from '../client/[id]';
import AvailabilityScreen from '../availability';

const network = api as unknown as { get: jest.Mock; patch: jest.Mock };
const schedulePath = '/mobile/employee/schedule/availability';
const client = (id: string, name: string) => ({
  id, name, firstName: null, lastName: null, phone: null, email: null, avatarUrl: null,
});
const schedule = {
  employeeId: 'employee-a',
  windows: [
    { id: 'w-1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
    { id: 'w-2', dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
    { id: 'w-3', dayOfWeek: 2, startTime: '10:00', endTime: '15:00', isActive: false },
  ],
  exceptions: [{ id: 'leave-1', startDate: '2026-10-20', endDate: '2026-10-21', reason: 'Leave' }],
};

async function mount(Screen: React.ComponentType) {
  await act(async () => { await i18n.changeLanguage('en'); });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  const element = (locale: 'en' | 'ar' = 'en') => (
    <QueryClientProvider client={queryClient}>
      <DirContext.Provider value={buildDirState(locale)}><Screen /></DirContext.Provider>
    </QueryClientProvider>
  );
  const view = render(element());
  return { ...view, queryClient, element };
}

beforeEach(() => {
  jest.clearAllMocks();
  network.get.mockReset();
  network.patch.mockReset();
  mockClientId = 'client-a';
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => { jest.restoreAllMocks(); });

describe('employee clients resource recovery', () => {
  it('shows an actionable read error and recovers, instead of reporting no clients', async () => {
    network.get.mockRejectedValueOnce(new Error('offline'));
    const view = await mount(ClientsScreen);
    const retry = await view.findByText(i18n.t('common.tryAgain'));
    expect(view.queryByText(i18n.t('doctor.noClients'))).toBeNull();
    network.get.mockResolvedValue({ data: { data: [client('client-a', 'Nora A')] } });
    fireEvent.press(retry);
    await view.findByText('Nora A');
    expect(view.queryByText(i18n.t('common.error'))).toBeNull();
  });

  it('keeps a successfully read empty list distinct from an error', async () => {
    network.get.mockResolvedValue({ data: { data: [] } });
    const view = await mount(ClientsScreen);
    await view.findByText(i18n.t('doctor.noClients'));
    expect(view.queryByText(i18n.t('common.tryAgain'))).toBeNull();
  });
});

describe('employee client identity and recovery', () => {
  it('offers recovery when one resource fails while the other is still pending', async () => {
    network.get.mockImplementation((path: string) => path.endsWith('/history')
      ? new Promise(() => undefined)
      : Promise.reject(new Error('offline')));
    const view = await mount(ClientScreen);
    await view.findByText(i18n.t('common.tryAgain'));
    expect(view.queryByText(i18n.t('common.noResults'))).toBeNull();
    fireEvent.press(view.getByLabelText(i18n.t('a11y.buttonBack')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('clears a failed read when retry supplies the record and history', async () => {
    network.get.mockRejectedValue(new Error('offline'));
    const view = await mount(ClientScreen);
    const retry = await view.findByText(i18n.t('common.tryAgain'));
    network.get.mockImplementation(async (path: string) => ({
      data: path.endsWith('/history') ? [] : client('client-a', 'Nora A'),
    }));
    fireEvent.press(retry);
    await view.findByText('Nora A');
    expect(view.queryByText(i18n.t('common.error'))).toBeNull();
  });

  it('never lets the previous client response replace the newly selected client', async () => {
    let resolvePrevious: (value: { data: ReturnType<typeof client> }) => void = () => undefined;
    network.get.mockImplementation((path: string) => {
      if (path.endsWith('/history')) return Promise.resolve({ data: [] });
      if (path.endsWith('/client-a')) {
        return new Promise((resolve) => { resolvePrevious = resolve; });
      }
      return Promise.resolve({ data: client('client-b', 'Sara B') });
    });
    const view = await mount(ClientScreen);
    mockClientId = 'client-b';
    view.rerender(view.element());
    await view.findByText('Sara B');
    await act(async () => { resolvePrevious({ data: client('client-a', 'Nora A') }); });
    expect(view.getByText('Sara B')).toBeTruthy();
    expect(view.queryByText('Nora A')).toBeNull();
  });

  it('does not show cached previous client details while another client loads', async () => {
    network.get.mockImplementation(async (path: string) => ({
      data: path.endsWith('/history') ? [] : client('client-a', 'Nora A'),
    }));
    const view = await mount(ClientScreen);
    await view.findByText('Nora A');
    network.get.mockImplementation(() => new Promise(() => undefined));
    mockClientId = 'client-b';
    view.rerender(view.element());
    expect(view.queryByText('Nora A')).toBeNull();
    expect(view.queryByText(i18n.t('common.noResults'))).toBeNull();
  });
});

describe('employee availability resource recovery and draft', () => {
  it('does not manufacture editable days on failure and restores save after retry', async () => {
    network.get.mockRejectedValueOnce(new Error('offline'));
    const view = await mount(AvailabilityScreen);
    const retry = await view.findByText(i18n.t('common.tryAgain'));
    expect(view.queryByText(i18n.t('availability.save'))).toBeNull();
    expect(view.UNSAFE_queryAllByType(Switch)).toHaveLength(0);
    network.get.mockResolvedValue({ data: schedule });
    fireEvent.press(retry);
    await view.findByText('09:00');
    expect(view.getByText(i18n.t('availability.save'))).toBeTruthy();
    expect(view.UNSAFE_getAllByType(Switch)).toHaveLength(7);
  });

  it('preserves all loaded windows and exceptions in a dirty draft across language changes and refresh', async () => {
    network.get.mockResolvedValue({ data: schedule });
    network.patch.mockImplementation(async (_path: string, payload: unknown) => ({ data: payload }));
    const view = await mount(AvailabilityScreen);
    await view.findByText('09:00');
    fireEvent(view.getByLabelText(i18n.t('days.1')), 'valueChange', false);
    network.get.mockResolvedValue({ data: { ...schedule, windows: [], exceptions: [] } });
    await act(async () => { await i18n.changeLanguage('ar'); });
    view.rerender(view.element('ar'));
    await act(async () => {
      await view.queryClient.invalidateQueries({ queryKey: ['employee', 'availability'] });
    });
    expect(view.getByLabelText(i18n.t('days.1')).props.value).toBe(false);
    fireEvent.press(view.getByText(i18n.t('availability.save')));
    await waitFor(() => expect(network.patch).toHaveBeenCalledWith(schedulePath, {
      windows: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: false },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: false },
        { dayOfWeek: 2, startTime: '10:00', endTime: '15:00', isActive: false },
      ],
      exceptions: [{ startDate: '2026-10-20', endDate: '2026-10-21', reason: 'Leave' }],
    }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('refreshes schedule and invalidates slot and available-day reads after saving', async () => {
    network.get.mockResolvedValue({ data: schedule });
    network.patch.mockResolvedValue({ data: { windows: schedule.windows, exceptions: schedule.exceptions } });
    const view = await mount(AvailabilityScreen);
    await view.findByText('09:00');
    const slotsKey = ['therapists', 'slots', { employeeId: 'employee-a', date: '2026-10-20' }];
    view.queryClient.setQueryDefaults(['therapists', 'slots'], { gcTime: Infinity });
    view.queryClient.setQueryData(slotsKey, [{ startTime: '09:00', endTime: '10:00' }]);
    const daysKey = ['therapists', 'available-days', { employeeId: 'employee-a', month: '2026-10' }];
    view.queryClient.setQueryDefaults(['therapists', 'available-days'], { gcTime: Infinity });
    view.queryClient.setQueryData(daysKey, ['2026-10-20']);
    const savedWindows = [{ dayOfWeek: 3, startTime: '11:00', endTime: '16:00', isActive: true }];
    network.get.mockResolvedValue({ data: { ...schedule, windows: savedWindows } });
    fireEvent.press(view.getByText(i18n.t('availability.save')));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(view.queryClient.getQueryState(slotsKey)?.isInvalidated).toBe(true);
    expect(view.queryClient.getQueryState(daysKey)?.isInvalidated).toBe(true);
    expect(view.queryClient.getQueryData(['employee', 'availability'])).toEqual({
      ...schedule, windows: savedWindows,
    });
  });
});
