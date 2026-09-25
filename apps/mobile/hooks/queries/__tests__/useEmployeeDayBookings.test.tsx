import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetAll = jest.fn();
jest.mock('@/services/employee/bookings', () => ({
  employeeBookingsService: { getAll: (...args: unknown[]) => mockGetAll(...args) },
}));

import { useEmployeeDayBookings } from '../useEmployeeDayBookings';
import type { Booking } from '@/types/models';

const DATE = '2026-09-25';

function booking(id: string, startTime: string, status: 'confirmed' | 'pending' = 'confirmed') {
  return { id, date: DATE, startTime, status } as unknown as Booking;
}

function page(items: Booking[], hasNextPage: boolean) {
  return { success: true as const, data: { items, meta: { hasNextPage } } };
}

// gcTime: 0 keeps react-query's garbage-collection timer from holding the jest
// process open after the suite finishes.
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  jest.clearAllTimers();
});

describe('useEmployeeDayBookings', () => {
  beforeEach(() => {
    mockGetAll.mockReset();
  });

  it('queries both active statuses for the selected day and sorts by start time', async () => {
    mockGetAll.mockImplementation(async ({ status }: { status: string }) =>
      status === 'confirmed'
        ? page([booking('b-2', '14:00'), booking('b-1', '09:00')], false)
        : page([booking('b-3', '11:00', 'pending')], false));

    const { result } = renderHook(() => useEmployeeDayBookings(DATE), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((b) => b.id)).toEqual(['b-1', 'b-3', 'b-2']);
    expect(mockGetAll).toHaveBeenCalledWith({
      status: 'confirmed', fromDate: DATE, toDate: DATE, page: 1,
    });
    expect(mockGetAll).toHaveBeenCalledWith({
      status: 'pending', fromDate: DATE, toDate: DATE, page: 1,
    });
  });

  it('follows pagination until the day is exhausted', async () => {
    mockGetAll.mockImplementation(async ({ status, page: pageNumber }: { status: string; page: number }) => {
      if (status !== 'confirmed') return page([], false);
      return pageNumber === 1
        ? page([booking('b-1', '09:00')], true)
        : page([booking('b-2', '10:00')], false);
    });

    const { result } = renderHook(() => useEmployeeDayBookings(DATE), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((b) => b.id)).toEqual(['b-1', 'b-2']);
    expect(mockGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed', page: 2 }),
    );
  });

  it('surfaces a load failure instead of reporting an empty day', async () => {
    mockGetAll.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useEmployeeDayBookings(DATE), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isSuccess).toBe(false);
  });
});
