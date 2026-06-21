import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPublicGroupSessions,
  getPublicGroupSession,
  bookGroupSession,
  type SupportGroup,
} from './support-groups.api';

const sample: SupportGroup = {
  id: 'prog-1',
  ref: 1,
  title: 'برنامج تواصل',
  nameAr: 'برنامج تواصل',
  nameEn: 'Communication Program',
  descriptionAr: 'وصف',
  descriptionEn: 'desc',
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  departmentId: 'd-1',
  branchId: 'b-1',
  startDate: '2026-05-01T18:00:00Z',
  daysCount: 4,
  hoursPerDay: 2,
  minParticipants: 4,
  maxParticipants: 10,
  enrolledCount: 3,
  price: '50000',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 7,
  // Back-compat aliases
  scheduledAt: '2026-05-01T18:00:00Z',
  durationMins: 120,
  maxCapacity: 10,
  serviceId: '',
  employeeId: '',
};

describe('support-groups.api (programs backend)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPublicGroupSessions', () => {
    it('requests /public/programs without a departmentId when none is provided', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ programs: [sample] }) });
      await getPublicGroupSessions();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/public\/programs$/);
      expect(init).toMatchObject({ next: { revalidate: 60 } });
    });

    it('encodes departmentId in the query string', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ programs: [sample] }) });
      await getPublicGroupSessions('d/1');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(`departmentId=${encodeURIComponent('d/1')}`);
    });

    it('unwraps the { programs } envelope', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ programs: [sample] }) });
      await expect(getPublicGroupSessions()).resolves.toEqual([sample]);
    });

    it('falls back to an empty list on non-ok response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      await expect(getPublicGroupSessions()).resolves.toEqual([]);
    });
  });

  describe('getPublicGroupSession', () => {
    it('URL-encodes the program id', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
      await getPublicGroupSession('prog/1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain(encodeURIComponent('prog/1'));
      expect(init.next).toEqual({ revalidate: 60 });
    });
  });

  describe('bookGroupSession', () => {
    it('POSTs to /public/programs/:id/enroll with credentials:include', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'ENROLLED', bookingId: 'bk1' }),
      });
      const out = await bookGroupSession('prog-1');
      expect(out).toEqual({ type: 'ENROLLED', bookingId: 'bk1' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/public\/programs\/prog-1\/enroll$/);
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
    });

    it('surfaces the backend error message on failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        text: () => Promise.resolve('Already enrolled'),
      });
      await expect(bookGroupSession('prog-1')).rejects.toThrow(/Already enrolled|Conflict/);
    });
  });
});
