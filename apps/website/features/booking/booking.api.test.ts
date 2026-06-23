import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
const { getApiBaseMock } = vi.hoisted(() => ({
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

import {
  getPublicBranches,
  getPublicAvailabilityDays,
  getPublicAvailability,
  createBooking,
  initPayment,
  getPractitionerBookingOptions,
  createGuestBooking,
  initGuestPayment,
} from './booking.api';
import type { AvailableSlot } from '@sawaa/shared';

const SAMPLE_BRANCH = {
  id: 'b1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  city: 'Riyadh',
  addressAr: 'العنوان',
  isMain: true,
};

const SAMPLE_SLOT: AvailableSlot = {
  startTime: '2026-07-01T10:00:00.000Z',
  endTime: '2026-07-01T11:00:00.000Z',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('booking.api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getPublicBranches', () => {
    it('hits /public/branches and unwraps { data: T } envelopes', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [SAMPLE_BRANCH] }));
      const result = await getPublicBranches();
      expect(result).toEqual([SAMPLE_BRANCH]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/branches');
      expect(init.cache).toBe('no-store');
    });

    it('passes through bare payloads with no envelope', async () => {
      fetchMock.mockResolvedValue(jsonResponse([SAMPLE_BRANCH]));
      await expect(getPublicBranches()).resolves.toEqual([SAMPLE_BRANCH]);
    });

    it('throws PublicFetchError on a 500 response', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Down' }), { status: 500 }),
      );
      await expect(getPublicBranches()).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('getPublicAvailabilityDays', () => {
    it('omits empty query parameters', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
      await getPublicAvailabilityDays('emp1');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/employees/emp1/availability/days');
    });

    it('encodes provided options into the query string', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
      await getPublicAvailabilityDays('emp1', {
        serviceId: 'svc1',
        branchId: 'br1',
        startDate: '2026-07-01',
        days: 7,
      });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('serviceId=svc1');
      expect(url).toContain('branchId=br1');
      expect(url).toContain('startDate=2026-07-01');
      expect(url).toContain('days=7');
    });
  });

  describe('getPublicAvailability', () => {
    it('always sends the date param and forwards optional delivery/booking fields', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [SAMPLE_SLOT] }));
      await getPublicAvailability('emp1', '2026-07-01', 'svc1', 'br1', {
        durationOptionId: 'opt1',
        deliveryType: 'ONLINE',
        bookingType: 'INDIVIDUAL',
      });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('date=2026-07-01');
      expect(url).toContain('serviceId=svc1');
      expect(url).toContain('branchId=br1');
      expect(url).toContain('durationOptionId=opt1');
      expect(url).toContain('deliveryType=ONLINE');
      expect(url).toContain('bookingType=INDIVIDUAL');
    });

    it('unwraps { data: [...] } envelopes', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [SAMPLE_SLOT] }));
      await expect(getPublicAvailability('emp1', '2026-07-01')).resolves.toEqual([SAMPLE_SLOT]);
    });
  });

  describe('createBooking', () => {
    it('POSTs to /public/bookings with credentials: include', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: { id: 'bk1', invoiceId: 'inv1' } }));
      const result = await createBooking({
        serviceId: 'svc1',
        employeeId: 'emp1',
        branchId: 'br1',
        startsAt: '2026-07-01T10:00:00.000Z',
        durationOptionId: 'opt1',
        deliveryType: 'ONLINE',
      });
      expect(result).toEqual({ id: 'bk1', invoiceId: 'inv1' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/bookings');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.headers.get('Content-Type')).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual({
        serviceId: 'svc1',
        employeeId: 'emp1',
        branchId: 'br1',
        startsAt: '2026-07-01T10:00:00.000Z',
        durationOptionId: 'opt1',
        deliveryType: 'ONLINE',
      });
    });

    it('omits an empty-string durationOptionId so backend UUID validation passes', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: { id: 'bk1', invoiceId: null } }));
      await createBooking({
        serviceId: 'svc1',
        employeeId: 'emp1',
        branchId: 'br1',
        startsAt: '2026-07-01T10:00:00.000Z',
        durationOptionId: '',
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty('durationOptionId');
    });
  });

  describe('initPayment', () => {
    it('POSTs the invoiceId to /public/payments/init with credentials', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ data: { paymentId: 'pay1', redirectUrl: 'https://moyasar/pay1' } }),
      );
      const result = await initPayment('inv1');
      expect(result).toEqual({ paymentId: 'pay1', redirectUrl: 'https://moyasar/pay1' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.local/api/v1/public/payments/init');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(JSON.parse(init.body as string)).toEqual({ invoiceId: 'inv1' });
    });

    it('throws when the init endpoint fails', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invoice not found' }), { status: 404 }),
      );
      await expect(initPayment('missing')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getPractitionerBookingOptions', () => {
    it('hits the practitioner-options endpoint with no-store cache', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: {
            useCustomPricing: true,
            disabledDeliveryTypes: ['IN_PERSON'],
            options: [
              {
                deliveryType: 'ONLINE',
                durationOptionId: 'opt1',
                durationMins: 60,
                price: 15000,
                currency: 'SAR',
                label: null,
              },
            ],
          },
        }),
      );
      const result = await getPractitionerBookingOptions('svc1', 'emp1');
      expect(result.useCustomPricing).toBe(true);
      expect(result.options).toHaveLength(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'http://api.local/api/v1/public/services/svc1/practitioners/emp1/booking-options',
      );
      expect(init.cache).toBe('no-store');
    });
  });

  describe('backwards-compatible aliases', () => {
    it('createGuestBooking is the same function as createBooking', () => {
      expect(createGuestBooking).toBe(createBooking);
    });
    it('initGuestPayment is the same function as initPayment', () => {
      expect(initGuestPayment).toBe(initPayment);
    });
  });
});
