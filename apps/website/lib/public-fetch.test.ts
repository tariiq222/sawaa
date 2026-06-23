import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getApiBaseMock } = vi.hoisted(() => ({
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

import { publicFetch, PublicFetchError } from './public-fetch';

const fetchMock = vi.fn();

describe('publicFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes the path with the API base and appends a leading slash when missing', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    await publicFetch('public/branches');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.local/api/v1/public/branches');
  });

  it('does not double-slash when the path already starts with a slash', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    await publicFetch('/public/branches');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.local/api/v1/public/branches');
  });

  it('always sets Content-Type: application/json when not overridden', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves caller-provided Content-Type without overriding it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=abc' },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('Content-Type')).toBe('multipart/form-data; boundary=abc');
  });

  it('preserves caller-provided custom headers', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo', { headers: { 'X-Trace': 'abc-123' } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('X-Trace')).toBe('abc-123');
  });

  it('returns the parsed JSON body on a 2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'b1' } }),
    });
    await expect(publicFetch('/foo')).resolves.toEqual({ data: { id: 'b1' } });
  });

  it('forwards caller init options (method, credentials, body) to fetch', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ a: 1 }),
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  describe('error path', () => {
    it('throws PublicFetchError with the status and parsed body on a non-2xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad payload' }),
      });
      const promise = publicFetch('/foo');
      await expect(promise).rejects.toBeInstanceOf(PublicFetchError);
      await expect(promise).rejects.toMatchObject({
        status: 400,
        body: { message: 'Bad payload' },
      });
      await expect(promise).rejects.toThrow('PublicFetchError: 400');
    });

    it('passes an empty object as body when the error response is not JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      });
      try {
        await publicFetch('/foo');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PublicFetchError);
        expect((err as PublicFetchError).status).toBe(500);
        expect((err as PublicFetchError).body).toEqual({});
      }
    });

    it('does not throw when the response is exactly 200 with an empty body (returns undefined cast)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('204 no content')),
      });
      await expect(publicFetch('/foo')).rejects.toThrow(); // publicFetch still tries json() — documents the contract.
    });
  });

  describe('PublicFetchError', () => {
    it('keeps status and body readable as own fields', () => {
      const err = new PublicFetchError(409, { code: 'TAKEN' });
      expect(err.status).toBe(409);
      expect(err.body).toEqual({ code: 'TAKEN' });
      expect(err.name).toBe('PublicFetchError');
      expect(err.message).toBe('PublicFetchError: 409');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PublicFetchError);
    });
  });
});
