jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../api';
import { notificationsService } from '../notifications';

const mockedApi = api as unknown as { get: jest.Mock };

describe('notificationsService.getAll', () => {
  beforeEach(() => mockedApi.get.mockReset());

  it('lower-cases the backend UPPER_SNAKE_CASE type so the icon and deep-link maps match', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'n1', recipientId: 'c1', type: 'BOOKING_CONFIRMED', title: 'T', body: 'B', isRead: false, createdAt: '2026-09-30T10:00:00Z' },
          { id: 'n2', recipientId: 'c1', type: 'PAYMENT_FAILED', title: 'T', body: 'B', isRead: true, createdAt: '2026-09-30T10:00:00Z' },
        ],
        meta: { total: 2, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      },
    });

    const result = await notificationsService.getAll();

    expect(result.items.map((item) => item.type)).toEqual(['booking_confirmed', 'payment_failed']);
    expect(result.items[0]).toMatchObject({ userId: 'c1', titleAr: 'T', bodyEn: 'B' });
  });
});
