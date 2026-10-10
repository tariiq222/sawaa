import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockValues = new Map<string, string>();
let mockUserId: string | null = 'client-1';
let mockStorageUnavailable = false;
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => { if (mockStorageUnavailable) throw new Error('storage unavailable'); return mockValues.get(key) ?? null; },
  setItem: async (key: string, value: string) => { mockValues.set(key, value); },
  removeItem: async (key: string) => { mockValues.delete(key); },
} }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockUserId }));
jest.mock('@/services/client', () => ({ clientBookingsService: { cancel: jest.fn() } }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));
import { clientBookingsService } from '@/services/client';
import { getPendingBookingCheckout, savePendingBookingCheckout } from '@/features/booking/payment-resume-state';
import { useCancelBooking } from '../useBookingMutations';

const draft = { branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1', scheduledAt: '2026-10-15T10:00:00Z', durationOptionId: null, deliveryType: null };
const otherDraft = { ...draft, scheduledAt: '2026-10-15T11:00:00Z' };
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useCancelBooking(), { wrapper });
}
beforeEach(async () => {
  jest.clearAllMocks(); mockValues.clear(); mockUserId = 'client-1'; mockStorageUnavailable = false;
  await savePendingBookingCheckout('client-1', draft, { bookingId: 'booking-1', invoiceId: 'invoice-1' });
  await savePendingBookingCheckout('client-1', otherDraft, { bookingId: 'booking-2', invoiceId: 'invoice-2' });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
const vars = { id: 'booking-1', reason: 'change', acceptedRefundTerms: true as const, quoteToken: 'quote' };
it('successful direct cancellation removes only that booking checkout from local discovery', async () => {
  jest.mocked(clientBookingsService.cancel).mockResolvedValue({ id: 'booking-1', status: 'cancelled', requiresApproval: false } as Awaited<ReturnType<typeof clientBookingsService.cancel>>);
  const { result } = setup();
  await act(async () => { await result.current.mutateAsync(vars); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await expect(getPendingBookingCheckout('client-1', draft)).resolves.toEqual({ kind: 'missing' });
  await expect(getPendingBookingCheckout('client-1', otherDraft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-2' } });
});
it.each(['cancel_requested', 'pending', 'confirmed'] as const)('retains checkout identity when cancellation returns %s', async (status) => {
  jest.mocked(clientBookingsService.cancel).mockResolvedValue({ id: 'booking-1', status, requiresApproval: true } as Awaited<ReturnType<typeof clientBookingsService.cancel>>);
  const { result } = setup();
  await act(async () => { await result.current.mutateAsync(vars); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-1' } });
});
it('retains the checkout when cancellation fails', async () => {
  jest.mocked(clientBookingsService.cancel).mockRejectedValueOnce(new Error('stale quote'));
  const { result } = setup();
  await act(async () => { await expect(result.current.mutateAsync(vars)).rejects.toThrow('stale quote'); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-1' } });
});

it('a late cancellation response only cleans the authenticated owner that started it', async () => {
  await savePendingBookingCheckout('client-2', draft, { bookingId: 'other-client-booking', invoiceId: 'other-client-invoice' });
  let respond!: (value: Awaited<ReturnType<typeof clientBookingsService.cancel>>) => void;
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  jest.mocked(clientBookingsService.cancel).mockImplementationOnce(() => { started(); return new Promise((resolve) => { respond = resolve; }); });
  const { result, rerender } = setup();
  let mutation!: Promise<unknown>;
  act(() => { mutation = result.current.mutateAsync(vars); });
  await requestStarted;
  mockUserId = 'client-2'; rerender({});
  await act(async () => {
    respond({ id: 'booking-1', status: 'cancelled', requiresApproval: false } as Awaited<ReturnType<typeof clientBookingsService.cancel>>);
    await mutation;
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await expect(getPendingBookingCheckout('client-1', draft)).resolves.toEqual({ kind: 'missing' });
  await expect(getPendingBookingCheckout('client-2', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'other-client-booking' } });
});
it('a storage cleanup failure does not report the committed cancellation as failed', async () => {
  jest.mocked(clientBookingsService.cancel).mockResolvedValue({ id: 'booking-1', status: 'cancelled', requiresApproval: false } as Awaited<ReturnType<typeof clientBookingsService.cancel>>);
  const { result } = setup();
  mockStorageUnavailable = true;
  await act(async () => { await result.current.mutateAsync(vars); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  mockStorageUnavailable = false;
  await expect(getPendingBookingCheckout('client-1', draft)).resolves.toMatchObject({ kind: 'found', checkout: { bookingId: 'booking-1' } });
});
