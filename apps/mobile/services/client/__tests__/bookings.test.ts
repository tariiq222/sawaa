jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

import api from '../../api';
import { clientBookingsService, type BookingsListResponse, type ClientBookingRow } from '../bookings';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const sampleRow: ClientBookingRow = {
  id: 'b1',
  invoiceId: 'inv-1',
  scheduledAt: '2026-05-01T10:00:00Z',
  durationMins: 30,
  status: 'confirmed',
  bookingType: 'online',
  employeeId: 'e1',
  branchId: 'br1',
  serviceId: 's1',
  zoomJoinUrl: null,
  zoomStartUrl: null,
  zoomMeetingStatus: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientBookingsService.list', () => {
  it('GETs /mobile/client/bookings and UPPERCASES the status param (backend DTO has no Transform)', async () => {
    const payload: BookingsListResponse = {
      items: [sampleRow],
      meta: {
        total: 1,
        page: 1,
        perPage: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const r = await clientBookingsService.list({ status: 'confirmed', page: 1, limit: 10 });

    expect(r).toEqual(payload);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', {
      params: { status: 'CONFIRMED', page: 1, limit: 10 },
    });
  });

  it('uppercases lowercase `completed` (the records.tsx case that was 400-ing)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [], meta: {} } });
    await clientBookingsService.list({ status: 'completed', limit: 50 });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', {
      params: { status: 'COMPLETED', limit: 50 },
    });
  });

  it('uppercases each entry when status is an array', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [], meta: {} } });
    await clientBookingsService.list({ status: ['pending', 'confirmed'] });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', {
      params: { status: ['PENDING', 'CONFIRMED'] },
    });
  });

  it('leaves params untouched when status is omitted', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [], meta: {} } });
    await clientBookingsService.list({ page: 2 });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', {
      params: { page: 2 },
    });
  });

  it('passes undefined params when none given', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [], meta: {} } });
    await clientBookingsService.list();
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', { params: undefined });
  });

  it('rethrows on 500 server errors', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    await expect(clientBookingsService.list()).rejects.toThrow(/500/);
  });
});

describe('clientBookingsService.getById', () => {
  it('GETs the right detail URL', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: sampleRow });
    const r = await clientBookingsService.getById('b1');
    expect(r).toEqual(sampleRow);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings/b1');
  });

  it('rejects on 401', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('401'));
    await expect(clientBookingsService.getById('b1')).rejects.toThrow(/401/);
  });
});

describe('clientBookingsService.create', () => {
  it('POSTs the dto to /mobile/client/bookings', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: sampleRow });
    const dto = {
      branchId: 'br1',
      employeeId: 'e1',
      serviceId: 's1',
      scheduledAt: '2026-05-01T10:00:00Z',
    };
    const r = await clientBookingsService.create(dto);
    expect(r).toEqual(sampleRow);
    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/client/bookings', dto);
  });

  it('rejects when slot conflict (409)', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('409 conflict'));
    await expect(
      clientBookingsService.create({
        branchId: 'br1',
        employeeId: 'e1',
        serviceId: 's1',
        scheduledAt: 'x',
      }),
    ).rejects.toThrow(/409/);
  });
});

describe('clientBookingsService.cancel / reschedule / rate / getJoinUrl', () => {
  it('cancel hits /cancel with reason body', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { ...sampleRow, status: 'cancelled' } });
    const r = await clientBookingsService.cancel('b1', 'changed plan');
    expect(r.status).toBe('cancelled');
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/mobile/client/bookings/b1/cancel',
      { reason: 'changed plan' },
    );
  });

  it('reschedule PATCHes the new scheduledAt', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: sampleRow });
    await clientBookingsService.reschedule('b1', '2026-05-02T11:00:00Z');
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/mobile/client/bookings/b1/reschedule',
      { scheduledAt: '2026-05-02T11:00:00Z' },
    );
  });

  it('rate POSTs the score+comment payload', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { ok: true } });
    await clientBookingsService.rate('b1', { score: 5, comment: 'great', isPublic: true });
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/mobile/client/bookings/b1/rate',
      { score: 5, comment: 'great', isPublic: true },
    );
  });

  it('getJoinUrl returns the zoom join payload', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { joinUrl: 'https://zoom/x', scheduledAt: '2026-05-01T10:00:00Z' },
    });
    const r = await clientBookingsService.getJoinUrl('b1');
    expect(r.joinUrl).toBe('https://zoom/x');
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings/b1/join');
  });

  it('getJoinUrl rejects when booking is not joinable yet (400)', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('400 too early'));
    await expect(clientBookingsService.getJoinUrl('b1')).rejects.toThrow(/400/);
  });
});
