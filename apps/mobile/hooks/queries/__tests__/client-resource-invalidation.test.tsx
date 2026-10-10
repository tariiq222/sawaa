import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => 'client-1' }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => 1, isSessionCurrent: () => true }));
jest.mock('@/services/client', () => ({
  clientBookingsService: { cancel: jest.fn() },
  clientPackagesService: { bookCredit: jest.fn() },
}));
jest.mock('@/services/client/group-sessions', () => ({ programsService: { enroll: jest.fn() } }));
import { clientBookingsService, clientPackagesService } from '@/services/client';
import { programsService } from '@/services/client/group-sessions';
import { useCancelBooking } from '../useBookingMutations';
import { useBookPackageCredit } from '../usePackages';
import { useBookGroupSession } from '../useGroupSessions';

const resources = [
  ['portal', 'home'], ['portal', 'summary'], ['portal', 'upcoming', { page: 1, limit: 10 }],
  ['bookings', 'list', {}], ['bookings', 'detail', 'booking-1'],
  ['packages', 'purchases', 'client-1'], ['programs', 'list'],
  ['client-payments', 'invoice', 'invoice-1'],
  ['therapists', 'slots', { employeeId: 'employee-1', branchId: 'branch-1' }],
  ['therapists', 'available-days', { employeeId: 'employee-1', branchId: 'branch-1' }],
];
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { retry: false } } });
  clients.push(client);
  resources.forEach((key) => client.setQueryData(key, { cached: true }));
  client.setQueryData(['public-branches', 'list'], [{ id: 'branch-1' }]);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => jest.clearAllMocks());
afterEach(() => { clients.splice(0).forEach((client) => client.clear()); });

it('cancellation makes portal, invoice, balances and availability stale after success', async () => {
  (clientBookingsService.cancel as jest.Mock).mockResolvedValue({ id: 'booking-1' });
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCancelBooking(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ id: 'booking-1', reason: 'change', acceptedRefundTerms: true, quoteToken: 'quote' }); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  expect(client.getQueryState(['public-branches', 'list'])?.isInvalidated).toBe(false);
});
it('a rejected cancellation preserves every cached resource', async () => {
  (clientBookingsService.cancel as jest.Mock).mockRejectedValue(new Error('stale quote'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCancelBooking(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync({ id: 'booking-1', reason: 'change', acceptedRefundTerms: true, quoteToken: 'quote' })).rejects.toThrow('stale quote'); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
});
it('booking a credit refreshes all client resources after success', async () => {
  (clientPackagesService.bookCredit as jest.Mock).mockResolvedValue({ id: 'booking-1' });
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useBookPackageCredit(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ creditId: 'credit-1', branchId: 'branch-1', scheduledAt: '2026-10-07T10:00:00Z' }); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
});
it('a rejected credit booking preserves the portal and balance', async () => {
  (clientPackagesService.bookCredit as jest.Mock).mockRejectedValue(new Error('slot unavailable'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useBookPackageCredit(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync({ creditId: 'credit-1', branchId: 'branch-1', scheduledAt: '2026-10-07T10:00:00Z' })).rejects.toThrow('slot unavailable'); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
});
it('group enrollment refreshes the portal, bookings and invoice', async () => {
  (programsService.enroll as jest.Mock).mockResolvedValue({ type: 'ENROLLED', bookingId: 'booking-1', invoiceId: 'invoice-1', status: 'AWAITING_PAYMENT' });
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useBookGroupSession(), { wrapper });
  await act(async () => { await result.current.mutateAsync('program-1'); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
});
it('a rejected group enrollment preserves cached resources', async () => {
  (programsService.enroll as jest.Mock).mockRejectedValue(new Error('full'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useBookGroupSession(), { wrapper });
  await act(async () => { await expect(result.current.mutateAsync('program-1')).rejects.toThrow('full'); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  resources.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
});
