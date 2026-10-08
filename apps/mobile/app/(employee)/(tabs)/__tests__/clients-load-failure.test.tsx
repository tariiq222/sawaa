import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mockGetAll = jest.fn();
jest.mock('@/services/clients', () => ({ clientsService: { getAll: (...args: unknown[]) => mockGetAll(...args) } }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => ({ firstName: 'Sara' }) }));

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
  return {
    ...actual,
    AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View } = require('react-native');
  return { Glass: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));


import i18n from '@/i18n';
import ClientsScreen from '../clients';
import { employeeClientsKeys } from '@/hooks/queries/useEmployeeClients';
const client = (name: string) => ({ id: name.toLowerCase(), name, firstName: null, lastName: null, phone: null, email: null, avatarUrl: null });
async function mount() {
  await act(async () => { await i18n.changeLanguage('en'); });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={queryClient}><ClientsScreen /></QueryClientProvider>);
  return { view, queryClient };
}
const title = () => i18n.t('doctor.clientsLoadFailed');
const retry = () => i18n.t('common.retry');
const empty = () => i18n.t('doctor.noClients');
const noResults = () => i18n.t('common.noResults');
const search = () => i18n.t('doctor.searchClients');
beforeEach(() => mockGetAll.mockReset());
it('first-read failure has retry and no success-empty copy', async () => {
  mockGetAll.mockRejectedValueOnce(new Error('offline'));
  const { view } = await mount();
  await waitFor(() => expect(view.getByText(title())).toBeTruthy());
  expect(view.queryByText(empty())).toBeNull();
  mockGetAll.mockResolvedValueOnce({ data: [] });
  fireEvent.press(view.getByText(retry()));
  await waitFor(() => expect(view.getByText(empty())).toBeTruthy());
});
it('retries failed search without success-empty copy', async () => {
  mockGetAll.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('offline'));
  const { view } = await mount();
  await waitFor(() => expect(view.getByText(empty())).toBeTruthy());
  fireEvent.changeText(view.getByPlaceholderText(search()), 'Nora');
  await waitFor(() => expect(view.getByText(title())).toBeTruthy());
  expect(view.queryByText(noResults())).toBeNull();
  mockGetAll.mockResolvedValueOnce({ data: [] });
  fireEvent.press(view.getByText(retry()));
  await waitFor(() => expect(view.getByText(noResults())).toBeTruthy());
  expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Nora', limit: 50 });
});
it.each([true, false])('retains current-search valid data on refetch failure: nonempty=%s', async (nonempty) => {
  const data = nonempty ? [client('Nora')] : [];
  mockGetAll.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data });
  const { view, queryClient } = await mount();
  await waitFor(() => expect(view.getByText(empty())).toBeTruthy());
  fireEvent.changeText(view.getByPlaceholderText(search()), 'Nora');
  await waitFor(() => expect(view.getByText(nonempty ? 'Nora' : noResults())).toBeTruthy());
  mockGetAll.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await queryClient.invalidateQueries({ queryKey: employeeClientsKeys.list('Nora', 50) }); });
  await waitFor(() => expect(view.getByText(title())).toBeTruthy());
  expect(view.getByText(nonempty ? 'Nora' : noResults())).toBeTruthy();
  mockGetAll.mockResolvedValueOnce({ data });
  fireEvent.press(view.getByText(retry()));
  await waitFor(() => expect(view.queryByText(title())).toBeNull());
  expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Nora', limit: 50 });
});
it('isolates previous search while new search is pending, failed, then retried', async () => {
  let rejectRead!: (error: Error) => void;
  mockGetAll.mockResolvedValueOnce({ data: [client('Nora')] });
  const { view } = await mount();
  await waitFor(() => expect(view.getByText('Nora')).toBeTruthy());
  mockGetAll.mockImplementationOnce(() => new Promise((_, reject) => { rejectRead = reject; }));
  fireEvent.changeText(view.getByPlaceholderText(search()), 'Omar');
  await waitFor(() => expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Omar', limit: 50 }));
  expect(view.queryByText('Nora')).toBeNull();
  expect(view.queryByText(noResults())).toBeNull();
  await act(async () => { rejectRead(new Error('offline')); });
  await waitFor(() => expect(view.getByText(title())).toBeTruthy());
  expect(view.queryByText('Nora')).toBeNull();
  expect(view.queryByText(noResults())).toBeNull();
  mockGetAll.mockResolvedValueOnce({ data: [client('Omar')] });
  fireEvent.press(view.getByText(retry()));
  await waitFor(() => expect(view.getByText('Omar')).toBeTruthy());
  expect(view.queryByText('Nora')).toBeNull();
  expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Omar', limit: 50 });
});
