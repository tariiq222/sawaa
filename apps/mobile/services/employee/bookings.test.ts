jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../api';
import { employeeBookingsService } from './bookings';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('employeeBookingsService', () => {
  it('adapts the raw employee list response for the existing UI', async () => {
    const list = { items: [{ id: 'booking-1' }], meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
    mockedApi.get.mockResolvedValueOnce({ data: list });

    await expect(employeeBookingsService.getTodayBookings()).resolves.toEqual({ success: true, data: list });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/schedule/today');
  });

  it('uses the authenticated employee booking route for detail', async () => {
    const booking = { id: 'booking-1' };
    mockedApi.get.mockResolvedValueOnce({ data: booking });

    await expect(employeeBookingsService.getById('booking-1')).resolves.toEqual({ success: true, data: booking });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/bookings/booking-1');
  });

  it('uses scalar status and an explicit day range for list queries', async () => {
    const list = { items: [{ id: 'booking-1', date: '2026-09-18', startTime: '13:00' }], meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
    mockedApi.get.mockResolvedValueOnce({ data: list });

    await expect(employeeBookingsService.getAll({
      status: 'confirmed',
      fromDate: '2026-09-18',
      toDate: '2026-09-18',
    })).resolves.toEqual({ success: true, data: list });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/bookings', {
      params: { status: 'confirmed', fromDate: '2026-09-18', toDate: '2026-09-18' },
    });
  });

  it('paginates each scalar status until the first future booking', async () => {
    mockedApi.get.mockImplementation(async (_url: string, config: { params: Record<string, unknown> }) => {
      const { status, page } = config.params;
      if (status === 'pending' && page === 1) {
        return {
          data: {
            items: [{ id: 'pending-past', date: '2000-01-01', startTime: '00:01' }],
            meta: { total: 2, page: 1, limit: 20, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
          },
        };
      }
      if (status === 'pending' && page === 2) {
        return {
          data: {
            items: [{ id: 'pending-day-31', date: '2099-10-31', startTime: '09:00' }],
            meta: { total: 2, page: 2, limit: 20, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
          },
        };
      }
      return {
        data: {
          items: [{ id: 'confirmed-day-31', date: '2099-10-31', startTime: '10:00' }],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
        },
      };
    });

    await expect(employeeBookingsService.getUpcoming()).resolves.toMatchObject({
      success: true,
      data: {
        items: [{ id: 'pending-day-31' }],
        meta: { total: 1, page: 1, limit: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      },
    });

    expect(mockedApi.get).toHaveBeenCalledTimes(3);
    for (const [, config] of mockedApi.get.mock.calls) {
      expect(config.params.status).toEqual(expect.any(String));
      expect(Array.isArray(config.params.status)).toBe(false);
      expect(config.params.fromDate).toEqual(expect.any(String));
      expect(config.params).not.toHaveProperty('toDate');
    }
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/bookings', {
      params: expect.objectContaining({ status: 'pending', page: 2, limit: 20 }),
    });
  });
});
