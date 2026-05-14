jest.mock('@/services/client', () => ({
  clientBookingsService: {
    list: jest.fn(),
    getById: jest.fn(),
    cancel: jest.fn(),
    rate: jest.fn(),
  },
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { clientBookingsService } from '@/services/client';
import { useClientBookings, clientBookingsKeys } from '../useClientBookings';
import { useUpcomingBookings } from '../useUpcomingBookings';
import { useBooking } from '../useBooking';
import { useCancelBooking, useRateBooking } from '../useBookingMutations';

const mockedList = clientBookingsService.list as jest.Mock;
const mockedGetById = clientBookingsService.getById as jest.Mock;
const mockedCancel = clientBookingsService.cancel as jest.Mock;
const mockedRate = clientBookingsService.rate as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useClientBookings', () => {
  it('fetches list and exposes data', async () => {
    const payload = {
      items: [{ id: 'b1' }],
      meta: { total: 1, page: 1, perPage: 10, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };
    mockedList.mockResolvedValueOnce(payload);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useClientBookings({ status: 'confirmed' }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(mockedList).toHaveBeenCalledWith({ status: 'confirmed' });
  });

  it('surfaces errors via isError', async () => {
    mockedList.mockRejectedValueOnce(new Error('500'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useClientBookings(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/500/);
  });

  it('exposes a stable cache key shape', () => {
    const key = clientBookingsKeys.list({ status: 'confirmed', page: 2 });
    expect(key).toEqual(['bookings', 'list', { status: 'confirmed', page: 2 }]);
  });
});

describe('useUpcomingBookings', () => {
  it('passes page=1 + limit by default', async () => {
    mockedList.mockResolvedValueOnce({ items: [], meta: {} });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpcomingBookings(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedList).toHaveBeenCalledWith({ limit: 50, page: 1 });
  });

  it('honours custom limit', async () => {
    mockedList.mockResolvedValueOnce({ items: [], meta: {} });
    const { Wrapper } = makeWrapper();
    renderHook(() => useUpcomingBookings(5), { wrapper: Wrapper });
    await waitFor(() => expect(mockedList).toHaveBeenCalledWith({ limit: 5, page: 1 }));
  });
});

describe('useBooking', () => {
  it('is disabled when id is undefined', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBooking(undefined), { wrapper: Wrapper });
    expect(mockedGetById).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches when id is provided', async () => {
    mockedGetById.mockResolvedValueOnce({ id: 'b1' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBooking('b1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetById).toHaveBeenCalledWith('b1');
  });
});

describe('useCancelBooking', () => {
  it('calls cancel and invalidates booking caches on success', async () => {
    mockedCancel.mockResolvedValueOnce({ id: 'b1', status: 'cancelled' });
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCancelBooking(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b1', reason: 'changed plan' });
    });

    expect(mockedCancel).toHaveBeenCalledWith('b1', 'changed plan');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientBookingsKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientBookingsKeys.detail('b1') });
  });

  it('exposes error when cancel rejects', async () => {
    mockedCancel.mockRejectedValueOnce(new Error('409 already cancelled'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelBooking(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'b1', reason: 'x' }),
      ).rejects.toThrow(/409/);
    });
    expect(result.current.isError).toBe(true);
  });
});

describe('useRateBooking', () => {
  it('forwards score+comment+isPublic and invalidates the detail cache', async () => {
    mockedRate.mockResolvedValueOnce({ ok: true });
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRateBooking(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'b1', score: 5, comment: 'great', isPublic: true });
    });

    expect(mockedRate).toHaveBeenCalledWith('b1', { score: 5, comment: 'great', isPublic: true });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientBookingsKeys.detail('b1') });
  });
});
