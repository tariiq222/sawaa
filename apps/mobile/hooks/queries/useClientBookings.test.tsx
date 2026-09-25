import React, { type PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClientBookings } from './useClientBookings';
import { clientBookingsService } from '@/services/client';

jest.mock('@/services/client', () => ({ clientBookingsService: { list: jest.fn() } }));
const list = jest.mocked(clientBookingsService.list);

it('fetches each tab/page separately and never shows cached upcoming rows as completed', async () => {
  list.mockImplementation(async (params) => ({
    items: [], meta: { total: params?.tab === 'upcoming' ? 51 : 1, page: params?.page ?? 1, perPage: 50, totalPages: 2, hasNextPage: params?.page === 1, hasPreviousPage: params?.page === 2 },
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender, unmount } = renderHook(({ tab, page }: { tab: 'upcoming' | 'past'; page: number }) => useClientBookings({ tab, page, limit: 50 }), { initialProps: { tab: 'upcoming', page: 1 }, wrapper });
  await waitFor(() => expect(result.current.data?.meta.total).toBe(51));
  rerender({ tab: 'upcoming', page: 2 });
  await waitFor(() => expect(result.current.data?.meta.page).toBe(2));
  expect(list).toHaveBeenLastCalledWith({ tab: 'upcoming', page: 2, limit: 50 });
  rerender({ tab: 'past', page: 1 });
  await waitFor(() => expect(result.current.data?.meta.total).toBe(1));
  expect(list).toHaveBeenLastCalledWith({ tab: 'past', page: 1, limit: 50 });
  unmount();
  client.clear();
});
