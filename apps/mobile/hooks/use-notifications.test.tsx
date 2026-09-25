jest.mock('@/services/notifications', () => ({
  notificationsService: {
    getAll: jest.fn(),
    getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ language: 'en' }) }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { notificationsService } from '@/services/notifications';
import { useNotifications } from './use-notifications';
import type { Notification } from '@/types/models';

const getAll = notificationsService.getAll as jest.Mock;

function notification(id: number): Notification {
  return {
    id: `notification-${id}`,
    type: 'reminder',
    titleAr: `عنوان ${id}`,
    titleEn: `Title ${id}`,
    bodyAr: `نص ${id}`,
    bodyEn: `Body ${id}`,
    isRead: false,
    createdAt: new Date(2025, 0, id).toISOString(),
  } as Notification;
}

function response(items: Notification[], page: number, totalPages: number) {
  return { items, meta: { totalPages, page, perPage: 20, total: totalPages * 20 } };
}

beforeEach(() => {
  getAll.mockReset();
  (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });
});

describe('useNotifications pagination', () => {
  it('loads older notifications beyond the first page', async () => {
    getAll.mockResolvedValueOnce(response(Array.from({ length: 20 }, (_, i) => notification(i)), 1, 2));
    getAll.mockResolvedValueOnce(response([notification(20)], 2, 2));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(20));

    await act(async () => result.current.loadMore());

    expect(getAll).toHaveBeenLastCalledWith({ page: 2, perPage: 20 });
    expect(result.current.notifications).toHaveLength(21);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps the page on failure and allows retrying it', async () => {
    getAll.mockResolvedValueOnce(response([notification(1)], 1, 2));
    getAll.mockRejectedValueOnce(new Error('temporary'));
    getAll.mockResolvedValueOnce(response([notification(2)], 2, 2));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => result.current.loadMore());
    expect(result.current.loadError).toBe(true);
    expect(result.current.hasMore).toBe(true);

    await act(async () => result.current.loadMore());
    expect(getAll.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 2]);
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.loadError).toBe(false);
  });

  it('retries a failed first-page refresh even when the previous list had no more pages', async () => {
    getAll.mockResolvedValueOnce(response([notification(1)], 1, 1));
    getAll.mockRejectedValueOnce(new Error('temporary refresh failure'));
    getAll.mockResolvedValueOnce(response([notification(9)], 1, 1));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    await act(async () => result.current.refresh());
    expect(result.current.loadError).toBe(true);
    expect(result.current.notifications.map(({ id }) => id)).toEqual(['notification-1']);

    await act(async () => result.current.loadMore());

    expect(getAll.mock.calls.map(([params]) => params.page)).toEqual([1, 1, 1]);
    expect(result.current.notifications.map(({ id }) => id)).toEqual(['notification-9']);
    expect(result.current.loadError).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a pending older-page response after refresh replaces the list', async () => {
    getAll.mockResolvedValueOnce(response([notification(1)], 1, 3));
    let resolveOlder!: (value: ReturnType<typeof response>) => void;
    getAll.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }));
    getAll.mockResolvedValueOnce(response([notification(9)], 1, 1));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    let olderRequest!: Promise<void>;
    await act(async () => {
      olderRequest = result.current.loadMore();
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.notifications.map(({ id }) => id)).toEqual(['notification-9']);

    await act(async () => {
      resolveOlder(response([notification(2)], 2, 3));
      await olderRequest;
    });
    expect(result.current.notifications.map(({ id }) => id)).toEqual(['notification-9']);
    expect(result.current.hasMore).toBe(false);
  });

  it('does not issue duplicate concurrent load-more requests', async () => {
    getAll.mockResolvedValueOnce(response([notification(1)], 1, 2));
    let resolveSecond!: (value: ReturnType<typeof response>) => void;
    getAll.mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.loadMore();
      await result.current.loadMore();
    });
    expect(getAll).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond(response([notification(2)], 2, 2));
      await first;
    });
    expect(result.current.notifications).toHaveLength(2);
  });
});
