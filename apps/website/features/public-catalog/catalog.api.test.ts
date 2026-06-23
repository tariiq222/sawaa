import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  getApiBaseMock,
  addBreadcrumbMock,
  captureExceptionMock,
  captureMessageMock,
} = vi.hoisted(() => ({
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
  addBreadcrumbMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  captureMessageMock: vi.fn(),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: addBreadcrumbMock,
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
}));

import { getPublicCatalog } from './catalog.api';
import type { PublicCatalog } from './types';

const sampleCatalog: PublicCatalog = {
  departments: [
    {
      id: 'd-1',
      nameAr: 'استشارات أسرية',
      nameEn: 'Family Counseling',
      descriptionAr: null,
      descriptionEn: null,
      icon: null,
      sortOrder: 1,
      isVisible: true,
      isActive: true,
    },
  ],
  categories: [
    {
      id: 'c-1',
      departmentId: 'd-1',
      nameAr: 'جلسات فردية',
      nameEn: 'Individual Sessions',
      sortOrder: 1,
      isActive: true,
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
    },
  ],
  services: [
    {
      id: 's-1',
      categoryId: 'c-1',
      nameAr: 'جلسة فردية',
      nameEn: 'Individual Session',
      descriptionAr: null,
      descriptionEn: null,
      durationMins: 60,
      price: '30000',
      currency: 'SAR',
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
    },
  ],
  vatRate: 0.15,
};

describe('catalog.api — getPublicCatalog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('GETs /public/services with the API base + 60s revalidation', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCatalog),
    });
    const promise = getPublicCatalog();
    await vi.runAllTimersAsync();
    await promise;

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.local/api/v1/public/services');
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it('returns the parsed JSON PublicCatalog on a 2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCatalog),
    });
    const promise = getPublicCatalog();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out).toEqual(sampleCatalog);
  });

  it('returns the EMPTY_CATALOG and logs a warning on a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const promise = getPublicCatalog();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out).toEqual({
      departments: [],
      categories: [],
      services: [],
      vatRate: 0,
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ status: 503 }),
      }),
    );
    expect(captureMessageMock).toHaveBeenCalledWith(
      '[catalog] fetch failed — using empty catalog',
      expect.objectContaining({
        level: 'warning',
        tags: { surface: 'public-catalog' },
        extra: { status: 503 },
      }),
    );
  });

  it('returns the EMPTY_CATALOG when the fetch throws and captures the exception', async () => {
    const err = new Error('network down');
    fetchMock.mockRejectedValue(err);
    const promise = getPublicCatalog();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out).toEqual({
      departments: [],
      categories: [],
      services: [],
      vatRate: 0,
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ error: 'network down' }),
      }),
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        level: 'warning',
        tags: { surface: 'public-catalog' },
      }),
    );
  });

  it('serialises a non-Error throw value into the breadcrumb data', async () => {
    fetchMock.mockRejectedValue('string error');
    const promise = getPublicCatalog();
    await vi.runAllTimersAsync();
    await promise;
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ error: 'string error' }),
      }),
    );
  });
});
