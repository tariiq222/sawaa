import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  publicFetchMock,
  addBreadcrumbMock,
} = vi.hoisted(() => ({
  publicFetchMock: vi.fn(),
  addBreadcrumbMock: vi.fn(),
}));

vi.mock('@/lib/public-fetch', () => ({
  publicFetch: publicFetchMock,
}));

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: addBreadcrumbMock,
}));

import { listPublicTestimonials } from './testimonials.api';

const sample = [
  { id: 't1', text: 'Great experience', name: 'Sara', letter: 'S', rating: 5, date: '2026-01-01' },
  { id: 't2', text: 'Helpful team', name: 'Omar', letter: 'O', rating: 4, date: '2026-01-02' },
];

describe('testimonials.api — listPublicTestimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicFetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls publicFetch with /public/testimonials?limit=<limit> and revalidate:60', async () => {
    publicFetchMock.mockResolvedValue(sample);
    await listPublicTestimonials(3);
    const [url, init] = publicFetchMock.mock.calls[0];
    expect(url).toBe('/public/testimonials?limit=3');
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it('defaults the limit to 6 when no argument is provided', async () => {
    publicFetchMock.mockResolvedValue(sample);
    await listPublicTestimonials();
    const [url] = publicFetchMock.mock.calls[0];
    expect(url).toBe('/public/testimonials?limit=6');
  });

  it('returns a bare array payload as-is (no envelope unwrapping)', async () => {
    publicFetchMock.mockResolvedValue(sample);
    await expect(listPublicTestimonials()).resolves.toEqual(sample);
  });

  it('unwraps a `{ data }` envelope into the underlying array', async () => {
    publicFetchMock.mockResolvedValue({ data: sample });
    await expect(listPublicTestimonials()).resolves.toEqual(sample);
  });

  it('returns an empty list when publicFetch throws and logs a Sentry breadcrumb', async () => {
    publicFetchMock.mockRejectedValue(new Error('upstream timeout'));
    await expect(listPublicTestimonials()).resolves.toEqual([]);
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ error: 'upstream timeout' }),
      }),
    );
  });

  it('serialises a non-Error throw value into the breadcrumb data', async () => {
    publicFetchMock.mockRejectedValue('network gone');
    await listPublicTestimonials();
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ error: 'network gone' }),
      }),
    );
  });

  it('returns an empty list when the response is neither an array nor has a data envelope', async () => {
    publicFetchMock.mockResolvedValue({ unexpected: 'shape' });
    await expect(listPublicTestimonials()).resolves.toEqual([]);
  });
});
