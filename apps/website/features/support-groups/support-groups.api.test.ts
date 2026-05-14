import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPublicGroupSessions,
  getPublicGroupSession,
  bookGroupSession,
  type SupportGroup,
} from './support-groups.api';

const sample: SupportGroup = {
  id: 'g1',
  title: 'Anxiety Group',
  descriptionAr: 'وصف',
  descriptionEn: 'desc',
  scheduledAt: '2026-05-01T18:00:00Z',
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 3,
  price: 50,
  currency: 'SAR',
  status: 'SCHEDULED',
  waitlistEnabled: true,
  waitlistCount: 0,
  employeeId: 'e1',
  serviceId: 's1',
  spotsLeft: 7,
  isFull: false,
  isWaitlistOnly: false,
};

describe('support-groups.api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPublicGroupSessions', () => {
    it('requests without branchId query when none is provided', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([sample]) });
      await getPublicGroupSessions();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/public\/bookings\/group-sessions$/);
      expect(init).toMatchObject({ next: { revalidate: 60, tags: ['public-group-sessions'] } });
    });

    it('encodes branchId in the query string', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([sample]) });
      await getPublicGroupSessions('branch/1');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(`branchId=${encodeURIComponent('branch/1')}`);
    });

    it('unwraps { data } envelope', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [sample] }) });
      await expect(getPublicGroupSessions()).resolves.toEqual([sample]);
    });

    it('throws on non-ok response with the status code', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      await expect(getPublicGroupSessions()).rejects.toThrow(/503/);
    });
  });

  describe('getPublicGroupSession', () => {
    it('URL-encodes the session id and tags the slug', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
      await getPublicGroupSession('ses/1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain(encodeURIComponent('ses/1'));
      expect(init.next.tags).toEqual(['public-group-sessions', `group-session-ses/1`]);
    });
  });

  describe('bookGroupSession', () => {
    it('POSTs with Bearer token and credentials:include', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'BOOKED', bookingId: 'bk1' }),
      });
      const out = await bookGroupSession('g1', 'tok');
      expect(out).toEqual({ type: 'BOOKED', bookingId: 'bk1' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/public\/bookings\/group-sessions\/g1\/book$/);
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
      expect(init.credentials).toBe('include');
    });

    it('surfaces the backend error message on failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
        json: () => Promise.resolve({ message: 'Already booked' }),
      });
      await expect(bookGroupSession('g1', 'tok')).rejects.toThrow('Already booked');
    });

    it('falls back to statusText when the error body has no message', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
        json: () => Promise.reject(new Error('not json')),
      });
      await expect(bookGroupSession('g1', 'tok')).rejects.toThrow('Server Error');
    });
  });
});
