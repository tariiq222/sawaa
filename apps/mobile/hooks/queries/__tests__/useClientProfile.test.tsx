import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

let mockEpoch = 1;
const mockUpdate = jest.fn();
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => 'client-1' }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (epoch: number) => epoch === mockEpoch }));
jest.mock('@/services/client', () => ({ clientProfileService: { updateProfile: (...args: unknown[]) => mockUpdate(...args) } }));
import { useUpdateClientProfile } from '../useClientProfile';

const profile = { id: 'client-1', name: 'Sara', firstName: 'Sara', lastName: null, email: 'sara@example.com', phone: null, avatarUrl: null, gender: null, dateOfBirth: null, preferredLocale: 'ar', pushEnabled: true };
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => { mockEpoch = 1; jest.clearAllMocks(); mockUpdate.mockResolvedValue(profile); });
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
it('rejects a profile response when the account changes during cache refresh before Redux synchronization', async () => {
  let finishRefresh!: () => void;
  const refresh = new Promise<{ name: string }>((resolve) => { finishRefresh = () => resolve({ name: 'Sara' }); });
  const { wrapper } = setup();
  const { result } = renderHook(() => {
    const me = useQuery({ queryKey: ['me', 1], queryFn: () => refresh, initialData: { name: 'Old' }, staleTime: Infinity });
    return { update: useUpdateClientProfile(), me };
  }, { wrapper });
  let pending!: Promise<unknown>;
  await act(async () => { pending = result.current.update.mutateAsync({ name: 'Sara' }); });
  await waitFor(() => expect(result.current.me.isFetching).toBe(true));
  await act(async () => {
    mockEpoch += 1;
    finishRefresh();
    await expect(pending).rejects.toThrow('Session changed');
  });
});
it('keeps profile and portal cached state unchanged after a rejected save', async () => {
  mockUpdate.mockRejectedValue(new Error('validation failed'));
  const { client, wrapper } = setup();
  client.setQueryData(['client-profile', 'client-1'], profile);
  client.setQueryData(['portal', 'home'], { name: 'Old' });
  const { result } = renderHook(() => useUpdateClientProfile(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync({ name: '' })).rejects.toThrow('validation failed'); });
  expect(client.getQueryData(['client-profile', 'client-1'])).toEqual(profile);
  expect(client.getQueryState(['portal', 'home'])?.isInvalidated).toBe(false);
});
