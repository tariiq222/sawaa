import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PublicBranding } from '@sawaa/shared';

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

import { getPublicBrandingForSsr } from './branding.api';

const sampleBranding: PublicBranding = {
  organizationNameAr: 'مركز سواء',
  organizationNameEn: 'Sawa Center',
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#55CCB0',
  colorPrimaryLight: '#7CD8C2',
  colorPrimaryDark: '#0E4B43',
  colorAccent: '#E7DBC4',
  colorAccentDark: '#CAAF7B',
  colorBackground: '#EAF8F4',
  fontFamily: 'Handicrafts',
  fontUrl: null,
  timeFormat: '24h',
  contactPhone: null,
  contactEmail: null,
};

describe('branding.api — getPublicBrandingForSsr', () => {
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

  it('GETs the /public/branding endpoint with the API base + 60s revalidation', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleBranding),
    });
    const promise = getPublicBrandingForSsr();
    await vi.runAllTimersAsync();
    await promise;

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.local/api/v1/public/branding');
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it('returns the parsed JSON PublicBranding on a 2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleBranding),
    });
    const promise = getPublicBrandingForSsr();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out).toEqual(sampleBranding);
  });

  it('falls back to DEFAULT_BRANDING on a non-ok response and logs a Sentry breadcrumb', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const promise = getPublicBrandingForSsr();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out.organizationNameAr).toBe('منظمتي');
    expect(out.colorPrimary).toBe('#55CCB0');
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ status: 503 }),
      }),
    );
  });

  it('falls back to DEFAULT_BRANDING when the fetch itself throws and logs a breadcrumb', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const promise = getPublicBrandingForSsr();
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out.organizationNameAr).toBe('منظمتي');
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        data: expect.objectContaining({ error: 'network down' }),
      }),
    );
  });

  it('aborts the in-flight fetch after 3000ms via AbortController and falls back to DEFAULT_BRANDING', async () => {
    let observedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init: RequestInit | undefined) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        // Reject when the AbortController fires so the catch path runs.
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const promise = getPublicBrandingForSsr();
    await vi.advanceTimersByTimeAsync(3001);
    const out = await promise;
    expect(observedSignal?.aborted).toBe(true);
    expect(out.organizationNameAr).toBe('منظمتي');
  });
});
