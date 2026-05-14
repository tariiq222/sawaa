import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMyBookingInvoice, type InvoiceDetail } from './invoice.api';

const sample: InvoiceDetail = {
  id: 'inv_abc',
  branchId: 'b1',
  clientId: 'c1',
  employeeId: 'e1',
  bookingId: 'bk1',
  subtotal: 100,
  discountAmt: 10,
  vatRate: 0.15,
  vatAmt: 13.5,
  total: 103.5,
  currency: 'SAR',
  status: 'PAID',
  issuedAt: '2026-04-17T10:00:00Z',
  dueAt: null,
  paidAt: '2026-04-17T10:05:00Z',
  createdAt: '2026-04-17T10:00:00Z',
};

describe('invoice.api — getMyBookingInvoice', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards the incoming cookie header to the backend by-booking endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
    await getMyBookingInvoice('bk1', 'ck_access=abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/public\/me\/bookings\/bk1\/invoice$/);
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({ cookie: 'ck_access=abc' });
  });

  it('URL-encodes the booking id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
    await getMyBookingInvoice('a/b c', '');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(encodeURIComponent('a/b c'));
  });

  it('unwraps { data: ... } envelopes and passes bare payloads through', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: sample }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(sample) });
    expect(await getMyBookingInvoice('bk1', '')).toEqual(sample);
    expect(await getMyBookingInvoice('bk1', '')).toEqual(sample);
  });

  it('throws the backend-provided message on non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Invoice not found' }),
    });
    await expect(getMyBookingInvoice('bk1', '')).rejects.toThrow('Invoice not found');
  });

  it('falls back to statusText when the error body has no message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Gateway Timeout',
      json: () => Promise.reject(new Error('not json')),
    });
    await expect(getMyBookingInvoice('bk1', '')).rejects.toThrow('Gateway Timeout');
  });
});
