import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listPublicEmployees, getPublicEmployee } from './therapists.api';
import type { PublicEmployee } from '@deqah/api-client';

const sample: PublicEmployee = {
  id: 'e1',
  slug: 'sara',
  nameAr: 'سارة',
  nameEn: 'Sara',
  title: null,
  specialty: null,
  specialtyAr: null,
  publicBioAr: null,
  publicBioEn: null,
  publicImageUrl: null,
};

describe('therapists.api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listPublicEmployees GETs /api/v1/public/employees with revalidation tags', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([sample]) });
    const out = await listPublicEmployees();
    expect(out).toEqual([sample]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/public\/employees$/);
    expect(init).toMatchObject({ next: { revalidate: 60, tags: ['public-employees'] } });
  });

  it('listPublicEmployees throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({ error: 'service unavailable' }) });
    await expect(listPublicEmployees()).rejects.toThrow('PublicFetchError: 503');
  });

  it('getPublicEmployee URL-encodes the slug and tags the slug', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: sample }) });
    await getPublicEmployee('dr smith/خاص');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(encodeURIComponent('dr smith/خاص'));
    expect(init).toMatchObject({
      next: { revalidate: 60, tags: ['public-employees', `employee-dr smith/خاص`] },
    });
  });

  it('getPublicEmployee throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not found' }) });
    await expect(getPublicEmployee('missing')).rejects.toThrow('PublicFetchError: 404');
  });
});
