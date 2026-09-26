jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

import api from '../../api';
import { clientBookingsService, wasRatedInCurrentSession, type BookingsListResponse, type ClientBookingRow } from '../bookings';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const sampleRow: ClientBookingRow = {
  id: 'b1',
  invoiceId: 'inv-1',
  scheduledAt: '2026-05-01T10:00:00Z',
  durationMins: 30,
  status: 'confirmed',
  bookingType: 'individual',
  deliveryType: 'online',
  employeeId: 'e1',
  branchId: 'br1',
  serviceId: 's1',
  zoomJoinUrl: null,
  zoomStartUrl: null,
  zoomMeetingStatus: null,
};

const mappedBookingWire = {
  id: 'b-program',
  bookingNumber: 42,
  employeeId: 'e-program',
  serviceId: null,
  type: 'group',
  deliveryType: 'in_person',
  date: '2026-09-25',
  startTime: '15:00',
  endTime: '17:00',
  status: 'pending',
  branchNameSnapshot: 'Main branch',
  priceSnapshot: 10000,
  durationMinutesSnapshot: 120,
  employee: { id: 'e-program', user: { firstName: 'A', lastName: 'Counselor' }, specialty: '', specialtyAr: '' },
  service: null,
  payment: { id: 'pay-1', amount: 10000, method: 'moyasar', status: 'pending', totalAmount: 10000 },
  invoice: { id: 'inv-program', subtotal: 10000, vatRate: 0, total: 10000, outstanding: 10000, status: 'DRAFT' },
  zoomJoinUrl: null,
  zoomStartUrl: null,
  zoomMeetingStatus: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientBookingsService.list', () => {
  it('passes the selected tab and next page to the server and retains pagination metadata', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [sampleRow], meta: { total: 51, page: 2, limit: 50, totalPages: 2, hasNextPage: false, hasPreviousPage: true } } });
    const result = await clientBookingsService.list({ tab: 'upcoming', page: 2, limit: 50 });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings', { params: { tab: 'upcoming', page: 2, limit: 50 } });
    expect(result.meta).toEqual({ total: 51, page: 2, perPage: 50, totalPages: 2, hasNextPage: false, hasPreviousPage: true });
  });
  it('normalizes mapped list rows and canonical limit metadata', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {
      items: [mappedBookingWire],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    } });
    const r = await clientBookingsService.list();
    expect(r.items[0]).toMatchObject({ invoiceId: 'inv-program', status: 'pending' });
    expect(r.meta.perPage).toBe(20);
  });

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
    expect(r).toEqual({ ...sampleRow, ratingSubmittedLocally: false });
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/bookings/b1');
  });

  it('preserves the backend booking type and server rating state in the detail response', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { ...sampleRow, bookingType: 'GROUP', hasRated: true } });

    await expect(clientBookingsService.getById('b1')).resolves.toMatchObject({
      bookingType: 'group',
      hasRated: true,
    });
  });

  it('rejects on 401', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('401'));
    await expect(clientBookingsService.getById('b1')).rejects.toThrow(/401/);
  });

  it('normalizes the actual nested mapper response used by the mobile controller', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mappedBookingWire });
    const r = await clientBookingsService.getById('b-program');
    expect(r).toMatchObject({
      id: 'b-program',
      invoiceId: 'inv-program',
      invoiceStatus: 'DRAFT',
      paymentStatus: 'pending',
      type: 'group',
      status: 'pending',
      scheduledAt: '2026-09-25T15:00:00+03:00',
      branchName: 'Main branch',
      employee: { nameEn: 'A Counselor' },
    });
  });

  it('does not expose the program booking sentinel as a scheduled appointment', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { ...mappedBookingWire, id: 'b-unscheduled', date: '2999-01-01', startTime: '03:00' },
    });
    await expect(clientBookingsService.getById('b-unscheduled')).resolves.toMatchObject({ scheduledAt: '' });
  });

  it('does not invent midnight when a mapped appointment has no valid start time', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { ...mappedBookingWire, id: 'b-no-time', startTime: null },
    });
    await expect(clientBookingsService.getById('b-no-time')).resolves.toMatchObject({ scheduledAt: '' });
  });
});

describe('clientBookingsService.create', () => {
  it('POSTs only the MobileCreateBookingDto fields to /mobile/client/bookings', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: sampleRow });
    const dto = {
      branchId: 'br1',
      employeeId: 'e1',
      serviceId: 's1',
      scheduledAt: '2026-05-01T10:00:00Z',
      durationOptionId: 'duration-1',
    };
    const r = await clientBookingsService.create(dto);
    expect(r).toEqual(sampleRow);
    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/client/bookings', dto);
    expect(mockedApi.post.mock.calls[0][1]).not.toHaveProperty('deliveryType');
  });

  it('sends the chosen online session as the backend DeliveryType enum value', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: sampleRow });
    await clientBookingsService.create({
      branchId: 'br1',
      employeeId: 'e1',
      serviceId: 's1',
      scheduledAt: '2026-05-01T10:00:00Z',
      durationOptionId: 'duration-online',
      deliveryType: 'online',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/client/bookings', {
      branchId: 'br1',
      employeeId: 'e1',
      serviceId: 's1',
      scheduledAt: '2026-05-01T10:00:00Z',
      durationOptionId: 'duration-online',
      deliveryType: 'ONLINE',
    });
  });

  it('sends an in-person session explicitly rather than relying on the server default', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: sampleRow });
    await clientBookingsService.create({
      branchId: 'br1',
      employeeId: 'e1',
      serviceId: 's1',
      scheduledAt: '2026-05-01T10:00:00Z',
      deliveryType: 'in_person',
    });

    expect(mockedApi.post.mock.calls[0][1]).toMatchObject({ deliveryType: 'IN_PERSON' });
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
  it('cancel PATCHes the backend cancellation DTO with an enum reason and notes', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { ...sampleRow, status: 'cancelled' } });
    const r = await clientBookingsService.cancel('b1', 'changed plan');
    expect(r.status).toBe('cancelled');
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/mobile/client/bookings/b1/cancel',
      { reason: 'CLIENT_REQUESTED', cancelNotes: 'changed plan' },
    );
  });

  it('reschedule PATCHes the newScheduledAt expected by the backend DTO', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: sampleRow });
    await clientBookingsService.reschedule('b1', '2026-05-02T11:00:00Z');
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/mobile/client/bookings/b1/reschedule',
      { newScheduledAt: '2026-05-02T11:00:00Z' },
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

  it('marks a booking as rated in this app session only after a successful response', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'b-rated-session' } });
    await clientBookingsService.rate('b-rated-session', { score: 5 });
    mockedApi.get.mockResolvedValueOnce({ data: { ...sampleRow, id: 'b-rated-session' } });

    expect(wasRatedInCurrentSession('b-rated-session')).toBe(true);
    await expect(clientBookingsService.getById('b-rated-session')).resolves.toMatchObject({ ratingSubmittedLocally: true });
  });

  it('recognizes the backend duplicate-rating conflict as already rated in this session', async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { data: { message: 'Rating already submitted for this booking' } } });

    await expect(clientBookingsService.rate('b-duplicate-session', { score: 5 })).rejects.toBeDefined();
    expect(wasRatedInCurrentSession('b-duplicate-session')).toBe(true);
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
