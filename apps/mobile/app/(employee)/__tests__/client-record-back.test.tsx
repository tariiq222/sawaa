import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
const mockGetById = jest.fn();
const mockGetHistory = jest.fn();
jest.mock('@/services/clients', () => ({ clientsService: { getById: (...args: unknown[]) => mockGetById(...args), getEmployeeBookings: (...args: unknown[]) => mockGetHistory(...args) } }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => ({ firstName: 'Sara' }) }));

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
 useLocalSearchParams: () => ({ id: 'client-1' }), useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }), router: { back: (...args: unknown[]) => mockBack(...args), replace: (...args: unknown[]) => mockReplace(...args), canGoBack: () => mockCanGoBack },
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
import ClientRecordScreen from '../client/[id]';
const queryClients: QueryClient[] = [];
function renderScreen() {
 const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
 queryClients.push(queryClient);
 return render(<QueryClientProvider client={queryClient}><ClientRecordScreen /></QueryClientProvider>);
}
afterEach(() => { queryClients.splice(0).forEach(client => client.clear()); });
const record = { id: 'client-1', name: 'Nora', firstName: null, lastName: null, email: 'nora@example.com', phone: '+966501234567', avatarUrl: null };
beforeEach(async () => { jest.clearAllMocks(); mockGetById.mockReset(); mockGetHistory.mockReset(); mockCanGoBack = false; await act(async () => { await i18n.changeLanguage('en'); }); });
it.each(['loading', 'error', 'success'] as const)('cold and warm back remain reachable during %s', async state => {
 for (const warm of [false, true]) {
  jest.clearAllMocks(); mockCanGoBack = warm;
  if (state === 'loading') { mockGetById.mockImplementationOnce(() => new Promise(() => {})); mockGetHistory.mockImplementationOnce(() => new Promise(() => {})); }
  else if (state === 'error') { mockGetById.mockRejectedValueOnce(new Error('offline')); mockGetHistory.mockResolvedValueOnce([]); }
  else { mockGetById.mockResolvedValueOnce(record); mockGetHistory.mockResolvedValueOnce([]); }
  const view = renderScreen();
  if (state === 'success') await waitFor(() => expect(view.getByText('Nora')).toBeTruthy());
  if (state === 'error') await waitFor(() => expect(view.getByText(i18n.t('common.error'))).toBeTruthy());
  fireEvent.press(view.getByLabelText(i18n.t('a11y.buttonBack')));
  if (warm) { expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled(); }
  else { expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/clients'); expect(mockBack).not.toHaveBeenCalled(); }
  view.unmount();
 }
});
