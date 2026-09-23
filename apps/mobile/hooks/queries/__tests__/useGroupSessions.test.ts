jest.mock('@/services/client/group-sessions', () => ({
  programsService: { enroll: jest.fn() },
}));
jest.mock('../useClientBookings', () => ({
  clientBookingsKeys: {
    all: ['bookings'],
  },
}));

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { programsService } from '@/services/client/group-sessions';
import { clientBookingsKeys } from '../useClientBookings';
import { useBookGroupSession } from '../useGroupSessions';

const mockedEnroll = programsService.enroll as jest.Mock;

describe('useBookGroupSession', () => {
  it('invalidates appointment caches after enrollment creates or reuses a booking', async () => {
    mockedEnroll.mockResolvedValueOnce({
      type: 'ENROLLED',
      bookingId: 'booking-1',
      status: 'AWAITING_PAYMENT',
      invoiceId: 'invoice-1',
    });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const Wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );

    const { result, unmount } = renderHook(() => useBookGroupSession(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync('program-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientBookingsKeys.all });
    unmount();
    for (const mutation of queryClient.getMutationCache().getAll()) mutation.destroy();
    queryClient.clear();
  });
});
