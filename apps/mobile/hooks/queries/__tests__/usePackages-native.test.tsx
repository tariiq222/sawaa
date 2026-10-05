import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockEpoch = 1;
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (epoch: number) => epoch === mockEpoch }));
const mockInitPurchase = jest.fn();
let mockClientId: string | undefined = 'client-1';
const mockGetPurchase = jest.fn();
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockClientId }));
jest.mock('@/services/client', () => ({ clientPackagesService: { initPurchase: (...args: unknown[]) => mockInitPurchase(...args), getPurchase: (...args: unknown[]) => mockGetPurchase(...args) } }));
jest.mock('../useClientBookings', () => ({ clientBookingsKeys: { all: ['bookings'] } }));
import { useInitPackagePurchase, usePackagePurchase } from '../usePackages';

it('isolates authenticated purchase cache and pauses reads after logout', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockGetPurchase.mockResolvedValue({ id: 'purchase-1', status: 'ACTIVE' });
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => usePackagePurchase('purchase-1'), { wrapper });
  await waitFor(() => expect(hook.result.current.data?.status).toBe('ACTIVE'));
  mockGetPurchase.mockReturnValue(new Promise(() => undefined));
  mockClientId = 'client-2';
  hook.rerender({});
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => expect(mockGetPurchase).toHaveBeenCalledTimes(2));
  mockClientId = undefined;
  hook.rerender({});
  expect(hook.result.current.data).toBeUndefined();
  expect(mockGetPurchase).toHaveBeenCalledTimes(2);
  hook.unmount();
  client.clear();
});

it('rejects a queued native init mutation if its initiating session has changed', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useInitPackagePurchase(), { wrapper });
  let request!: Promise<unknown>;
  await act(async () => {
    request = result.current.mutateAsync({ packageId: 'p', branchId: 'b', idempotencyKey: 'k' });
    mockEpoch += 1;
    await expect(request).rejects.toThrow('Session changed');
  });
  expect(mockInitPurchase).not.toHaveBeenCalled();
  unmount(); client.clear();
});
