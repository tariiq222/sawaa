jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => 1 }));
jest.mock('@/services/notifications', () => ({
  notificationsService: {
    getUnreadCount: jest.fn(),
  },
}));

// expo-router's useFocusEffect — fire the callback on mount and run its
// cleanup on unmount, mirroring real focus behaviour.
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb]);
    },
  };
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { notificationsService } from '@/services/notifications';
import { useUnreadCount } from './useUnreadCount';

const mockedGet = notificationsService.getUnreadCount as unknown as jest.Mock;

const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return ({ children }: React.PropsWithChildren) => React.createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => {
  mockedGet.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  jest.useRealTimers();
});

describe('useUnreadCount', () => {
  it('fetches the unread count on mount and exposes it via `count`', async () => {
    mockedGet.mockResolvedValue({ count: 4 });

    const { result } = renderHook(() => useUnreadCount(), { wrapper: setup() });

    await waitFor(() => expect(result.current.count).toBe(4));
    expect(mockedGet).toHaveBeenCalled();
  });

  it('polls every 60s while focused', async () => {
    mockedGet.mockResolvedValue({ count: 1 });

    renderHook(() => useUnreadCount(), { wrapper: setup() });

    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    const callsBefore = mockedGet.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(mockedGet.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('keeps the previous value when the request fails', async () => {
    mockedGet.mockResolvedValueOnce({ count: 3 });
    mockedGet.mockResolvedValueOnce({ count: 3 });
    const { result } = renderHook(() => useUnreadCount(), { wrapper: setup() });
    await waitFor(() => expect(result.current.count).toBe(3));

    mockedGet.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.count).toBe(3);
  });
});
