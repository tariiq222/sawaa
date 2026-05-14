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

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { notificationsService } from '@/services/notifications';
import { useUnreadCount } from './useUnreadCount';

const mockedGet = notificationsService.getUnreadCount as unknown as jest.Mock;

beforeEach(() => {
  mockedGet.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useUnreadCount', () => {
  it('fetches the unread count on mount and exposes it via `count`', async () => {
    mockedGet.mockResolvedValue({ count: 4 });

    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => expect(result.current.count).toBe(4));
    expect(mockedGet).toHaveBeenCalled();
  });

  it('polls every 60s while focused', async () => {
    mockedGet.mockResolvedValue({ count: 1 });

    renderHook(() => useUnreadCount());

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
    const { result } = renderHook(() => useUnreadCount());
    await waitFor(() => expect(result.current.count).toBe(3));

    mockedGet.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.count).toBe(3);
  });
});
