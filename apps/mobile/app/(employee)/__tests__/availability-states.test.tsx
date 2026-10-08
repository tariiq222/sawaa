import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Keep the real pure toggle helper without initializing auth persistence via the transport.
jest.mock('@/services/api', () => ({ __esModule: true, default: {} }));
const mockGetAvailabilitySchedule = jest.fn();
const mockUpdateAvailabilitySchedule = jest.fn();
jest.mock('@/services/employees', () => ({ ...jest.requireActual('@/services/employees'), employeesService: {
 getAvailabilitySchedule: (...args: unknown[]) => mockGetAvailabilitySchedule(...args),
 updateAvailabilitySchedule: (...args: unknown[]) => mockUpdateAvailabilitySchedule(...args),
} }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => ({ firstName: 'Sara' }) }));

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
 Stack: { Screen: () => null }, router: { back: (...args: unknown[]) => mockBack(...args), replace: (...args: unknown[]) => mockReplace(...args), canGoBack: () => mockCanGoBack },
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
  return {
    ...actual,
    AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View } = require('react-native');
  return { Glass: ({ children, ...props }: { children?: React.ReactNode }) => <View {...props}>{children}</View> };
});

jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));



import i18n from '@/i18n';
import AvailabilityScreen from '../availability';
import type { EmployeeAvailability, AvailabilityException } from '@/services/employees';
const queryClients: QueryClient[] = [];
function renderScreen() {
 const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
 queryClients.push(queryClient);
 return render(<QueryClientProvider client={queryClient}><AvailabilityScreen /></QueryClientProvider>);
}
afterEach(() => { queryClients.splice(0).forEach(client => client.clear()); });
const windows: EmployeeAvailability[] = [{ id: 'w1', dayOfWeek: 0, startTime: '08:00', endTime: '10:00', isActive: true }, { id: 'w2', dayOfWeek: 0, startTime: '13:00', endTime: '15:00', isActive: true }];
const exceptions: AvailabilityException[] = [{ id: 'e1', startDate: '2026-10-08', endDate: '2026-10-09', reason: 'Leave' }];
beforeEach(async () => { jest.clearAllMocks(); mockGetAvailabilitySchedule.mockReset(); mockUpdateAvailabilitySchedule.mockReset(); mockCanGoBack = false; await act(async () => { await i18n.changeLanguage('en'); }); });
it('keeps failed read blocked, retries and saves all returned windows and exceptions', async () => {
 mockGetAvailabilitySchedule.mockRejectedValueOnce(new Error('offline'));
 const view = renderScreen();
 await waitFor(() => expect(view.getByText(i18n.t('availability.loadError'))).toBeTruthy());
 expect(view.queryAllByRole('switch')).toHaveLength(0);
 expect(view.queryByText(i18n.t('availability.save'))).toBeNull();
 expect(mockUpdateAvailabilitySchedule).not.toHaveBeenCalled();
 mockGetAvailabilitySchedule.mockResolvedValue({ windows, exceptions });
 fireEvent.press(view.getByText(i18n.t('common.retry')));
 await waitFor(() => expect(view.getByText('13:00')).toBeTruthy());
 mockUpdateAvailabilitySchedule.mockResolvedValue({ windows, exceptions });
 fireEvent.press(view.getByText(i18n.t('availability.save')));
 await waitFor(() => expect(mockUpdateAvailabilitySchedule).toHaveBeenCalledTimes(1));
 expect(mockUpdateAvailabilitySchedule.mock.calls[0][0]).toEqual({ windows, exceptions });
 await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/profile'));
 expect(mockBack).not.toHaveBeenCalled();
});
it('repeated rejection remains blocked and pending retry never writes', async () => {
 mockGetAvailabilitySchedule.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline again'));
 const view = renderScreen();
 await waitFor(() => expect(view.getByText(i18n.t('availability.loadError'))).toBeTruthy());
 fireEvent.press(view.getByText(i18n.t('common.retry')));
 await waitFor(() => expect(mockGetAvailabilitySchedule).toHaveBeenCalledTimes(2));
 await waitFor(() => expect(view.getByText(i18n.t('availability.loadError'))).toBeTruthy());
 let resolveRead!: (value: { windows: EmployeeAvailability[]; exceptions: AvailabilityException[] }) => void;
 mockGetAvailabilitySchedule.mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve; }));
 fireEvent.press(view.getByText(i18n.t('common.retry')));
 expect(view.queryAllByRole('switch')).toHaveLength(0);
 expect(view.queryByText(i18n.t('availability.save'))).toBeNull();
 expect(mockUpdateAvailabilitySchedule).not.toHaveBeenCalled();
 await act(async () => { resolveRead({ windows: [], exceptions: [] }); });
 await waitFor(() => expect(view.getAllByRole('switch')).toHaveLength(7));
 expect(view.getAllByRole('switch').every(item => item.props.value === false)).toBe(true);
 fireEvent.press(view.getByText(i18n.t('availability.save')));
 await waitFor(() => expect(mockUpdateAvailabilitySchedule).toHaveBeenCalledTimes(1));
 expect(mockUpdateAvailabilitySchedule.mock.calls[0][0]).toEqual({ windows: [], exceptions: [] });
});
it('saving blocks repeated presses and recovers after rejection', async () => {
 mockGetAvailabilitySchedule.mockResolvedValue({ windows, exceptions });
 let rejectSave!: (value: Error) => void;
 mockUpdateAvailabilitySchedule.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
 const view = renderScreen();
 await waitFor(() => expect(view.getByText('13:00')).toBeTruthy());
 fireEvent.press(view.getByText(i18n.t('availability.save')));
 const button = view.getByRole('button', { name: i18n.t('availability.save') });
 expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: true, disabled: true }));
 fireEvent.press(button);
 await waitFor(() => expect(mockUpdateAvailabilitySchedule).toHaveBeenCalledTimes(1));
 expect(mockUpdateAvailabilitySchedule.mock.calls[0][0]).toEqual({ windows, exceptions });
 await act(async () => { rejectSave(new Error('offline')); });
 await waitFor(() => expect(view.getByRole('button', { name: i18n.t('availability.save') }).props.accessibilityState.disabled).toBe(false));
});

it.each(['loading', 'error', 'success'] as const)('availability back is reachable during %s with cold/warm history', async state => {
 for (const warm of [false, true]) {
 jest.clearAllMocks(); mockCanGoBack = warm;
 if (state === 'loading') mockGetAvailabilitySchedule.mockImplementationOnce(() => new Promise(() => {}));
 else if (state === 'error') mockGetAvailabilitySchedule.mockRejectedValueOnce(new Error('offline'));
 else mockGetAvailabilitySchedule.mockResolvedValue({ windows, exceptions });
 const view = renderScreen();
 if (state === 'error') await waitFor(() => expect(view.getByText(i18n.t('availability.loadError'))).toBeTruthy());
 if (state === 'success') await waitFor(() => expect(view.getByText('13:00')).toBeTruthy());
 fireEvent.press(view.getByLabelText(i18n.t('a11y.buttonBack')));
 if (warm) { expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled(); }
 else { expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/profile'); expect(mockBack).not.toHaveBeenCalled(); }
 view.unmount();
 }
});
