import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getApiBaseMock } = vi.hoisted(() => ({
  getApiBaseMock: vi.fn(() => 'http://api.local/api/v1'),
}));

vi.mock('@/lib/api-base', () => ({
  getApiBase: getApiBaseMock,
}));

const fetchMock = vi.fn();
let publicFetch: typeof import('./public-fetch').publicFetch;
let PublicFetchError: typeof import('./public-fetch').PublicFetchError;
let publicErrorMessage: typeof import('./public-fetch').publicErrorMessage;

const CSRF_TOKEN = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function csrfBootstrapResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'x-csrf-token': CSRF_TOKEN }),
    json: () => Promise.resolve({}),
  };
}

describe('publicFetch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    getApiBaseMock.mockReturnValue('http://api.local/api/v1');
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.resetModules();
    ({ publicFetch, PublicFetchError, publicErrorMessage } = await import('./public-fetch'));
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it('sets Content-Type: application/json when a body is sent and not overridden', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const [, init] = fetchMock.mock.calls[1];
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('does not set Content-Type on a bodyless request', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('Content-Type')).toBeNull();
  });

  it('preserves caller-provided Content-Type without overriding it', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=abc' },
    });
    const [, init] = fetchMock.mock.calls[1];
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
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await publicFetch('/foo', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ a: 1 }),
    });
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('shares one safe CSRF bootstrap before concurrent unsafe browser requests', async () => {
    let resolveBootstrap: (response: ReturnType<typeof csrfBootstrapResponse>) => void = () => undefined;
    const bootstrap = new Promise<ReturnType<typeof csrfBootstrapResponse>>((resolve) => {
      resolveBootstrap = resolve;
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/public/branding')) return bootstrap;
      return Promise.resolve({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: () => Promise.resolve({ type: 'ENROLLED' }),
      });
    });

    const first = publicFetch('/public/programs/one/enroll', { method: 'POST' });
    const second = publicFetch('/public/programs/two/enroll', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.local/api/v1/public/branding');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });

    resolveBootstrap(csrfBootstrapResponse());
    await expect(Promise.all([first, second])).resolves.toEqual([
      { type: 'ENROLLED' },
      { type: 'ENROLLED' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls.slice(1)) {
      expect(init.headers.get('X-CSRF-Token')).toBe(CSRF_TOKEN);
      expect(init.credentials).toBe('include');
    }
  });

  it('fails closed without fetching when an unsafe request runs during SSR', async () => {
    vi.stubGlobal('window', undefined);

    await expect(publicFetch('/public/programs/one/enroll', { method: 'POST' })).rejects.toMatchObject({
      status: 0,
      body: { code: 'CSRF_BROWSER_REQUIRED' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid CSRF bootstrap token before sending the mutation', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-csrf-token': 'not-a-valid-token' }),
      json: () => Promise.resolve({}),
    });

    await expect(publicFetch('/public/programs/one/enroll', { method: 'POST' })).rejects.toMatchObject({
      status: 200,
      body: { code: 'CSRF_BOOTSTRAP_FAILED' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not replay a CSRF rejection when the request body is a ReadableStream', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-csrf-token': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }),
        json: () => Promise.resolve({ code: 'CSRF_INVALID' }),
      });

    await expect(
      publicFetch('/public/programs/one/enroll', {
        method: 'POST',
        body: new ReadableStream(),
      }),
    ).rejects.toMatchObject({ status: 403, body: { code: 'CSRF_INVALID' } });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.local/api/v1/public/branding',
      'http://api.local/api/v1/public/programs/one/enroll',
    ]);
  });

  it('retries a rejected unsafe request once with the CSRF token from its response', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-csrf-token': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }),
        json: () => Promise.resolve({ code: 'CSRF_INVALID' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: () => Promise.resolve({ id: 'booking-1' }),
      });
    const callerHeaders = new Headers({ 'X-Trace': 'trace-1' });
    const callerInit: RequestInit = {
      method: 'POST',
      credentials: 'omit',
      headers: callerHeaders,
      body: JSON.stringify({ slotId: 'slot-1' }),
    };

    await expect(publicFetch('/public/bookings', callerInit)).resolves.toEqual({ id: 'booking-1' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, firstInit] = fetchMock.mock.calls[1];
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(firstInit.credentials).toBe('include');
    expect(firstInit.headers.get('X-CSRF-Token')).toBe(CSRF_TOKEN);
    expect(retryInit.credentials).toBe('include');
    expect(retryInit.headers.get('X-Trace')).toBe('trace-1');
    expect(retryInit.headers.get('X-CSRF-Token')).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(callerInit.credentials).toBe('omit');
    expect(callerHeaders.get('X-CSRF-Token')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.local/api/v1/public/branding',
      'http://api.local/api/v1/public/bookings',
      'http://api.local/api/v1/public/bookings',
    ]);
  });

  it('does not retain a long-lived CSRF token from an earlier safe response', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-csrf-token': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }),
        json: () => Promise.resolve({ branches: [] }),
      })
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: () => Promise.resolve({ id: 'booking-2' }),
      });

    await publicFetch('/public/branches');
    await publicFetch('/public/bookings', { method: 'POST', body: JSON.stringify({ slotId: 'slot-2' }) });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.local/api/v1/public/branches',
      'http://api.local/api/v1/public/branding',
      'http://api.local/api/v1/public/bookings',
    ]);
    const [, mutationInit] = fetchMock.mock.calls[2];
    expect(mutationInit.credentials).toBe('include');
    expect(mutationInit.headers.get('X-CSRF-Token')).toBe(CSRF_TOKEN);
  });

  it('aborts a request after the default timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }),
    );

    const request = expect(publicFetch('/public/branches')).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await request;
  });

  it('bounds a hung unsafe mutation so its outcome becomes explicitly unknown', async () => {
    vi.useFakeTimers();
    let rejectMutation!: (reason: unknown) => void;
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockImplementationOnce((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          rejectMutation = reject;
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      );

    let rejected = false;
    let rejection: unknown;
    const request = publicFetch('/public/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId: 'slot-hung' }),
    }).then(
      () => undefined,
      (error: unknown) => {
        rejected = true;
        rejection = error;
      },
    );

    await vi.advanceTimersByTimeAsync(10_000);
    if (!rejected) {
      // Keep the RED test bounded if the current implementation leaves the
      // unsafe request pending forever.
      rejectMutation(new Error('test cleanup'));
    }

    await request;

    expect(rejected).toBe(true);
    expect(rejection).toMatchObject({ name: 'TimeoutError' });
  });

  it('keeps the deadline active while consuming a mutation response body', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: () => new Promise<never>(() => undefined),
      });

    const request = expect(publicFetch('/public/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId: 'slot-slow-body' }),
    })).rejects.toMatchObject({ name: 'TimeoutError' });

    await vi.advanceTimersByTimeAsync(10_000);
    await request;
  });

  it('preserves a caller AbortSignal on a safe request with the default timeout', async () => {
    const caller = new AbortController();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }),
    );

    const request = publicFetch('/public/branches', { signal: caller.signal });
    caller.abort(new DOMException('caller cancelled', 'AbortError'));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('adds a timeout signal to a mutation while keeping caller abort forwarding separate', async () => {
    const caller = new AbortController();
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: () => Promise.resolve({ id: 'booking-3' }),
      });

    await publicFetch('/public/bookings', {
      method: 'POST',
      signal: caller.signal,
      body: JSON.stringify({ slotId: 'slot-3' }),
    });

    const [, bootstrapInit] = fetchMock.mock.calls[0];
    const [, mutationInit] = fetchMock.mock.calls[1];
    expect(bootstrapInit.signal).toBeInstanceOf(AbortSignal);
    expect(bootstrapInit.signal).not.toBe(caller.signal);
    expect(mutationInit.signal).toBeInstanceOf(AbortSignal);
    expect(mutationInit.signal).not.toBe(caller.signal);
  });

  it('does not replay a safe request when its response carries a CSRF token', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({
        'x-csrf-token': 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      }),
      json: () => Promise.resolve({ code: 'FORBIDDEN' }),
    });

    await expect(publicFetch('/public/branches')).rejects.toMatchObject({ status: 403 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the final CSRF error body after one retry without parsing it twice', async () => {
    const firstErrorJson = vi.fn(() => Promise.resolve({ code: 'CSRF_INVALID' }));
    const finalErrorJson = vi.fn(() => Promise.resolve({ code: 'CSRF_INVALID', detail: 'still stale' }));
    fetchMock
      .mockResolvedValueOnce(csrfBootstrapResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-csrf-token': 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        }),
        json: firstErrorJson,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-csrf-token': 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        }),
        json: finalErrorJson,
      });

    await expect(publicFetch('/public/bookings', { method: 'POST' })).rejects.toMatchObject({
      status: 403,
      body: { code: 'CSRF_INVALID', detail: 'still stale' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(firstErrorJson).toHaveBeenCalledTimes(1);
    expect(finalErrorJson).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.local/api/v1/public/branding',
      'http://api.local/api/v1/public/bookings',
      'http://api.local/api/v1/public/bookings',
    ]);
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
        expect((err as InstanceType<typeof PublicFetchError>).status).toBe(500);
        expect((err as InstanceType<typeof PublicFetchError>).body).toEqual({});
      }
    });

    it('returns undefined on a 204 No Content response without parsing the body', async () => {
      const jsonSpy = vi.fn(() => Promise.reject(new Error('204 no content')));
      fetchMock.mockResolvedValue({ ok: true, status: 204, json: jsonSpy });
      await expect(publicFetch('/foo')).resolves.toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('returns undefined when a 2xx body fails to parse (empty body)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('unexpected end of JSON input')),
      });
      await expect(publicFetch('/foo')).resolves.toBeUndefined();
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

  describe('publicErrorMessage', () => {
    it('returns the backend message from a thrown HttpException body', () => {
      const err = new PublicFetchError(409, {
        statusCode: 409,
        message: 'هناك دفعة قيد التنفيذ لهذه الفاتورة',
      });
      expect(publicErrorMessage(err)).toBe('هناك دفعة قيد التنفيذ لهذه الفاتورة');
    });

    it('returns the first class-validator message from an array body', () => {
      const err = new PublicFetchError(400, { message: ['invoiceId must be a UUID'] });
      expect(publicErrorMessage(err)).toBe('invoiceId must be a UUID');
    });

    it('returns null for a non-fetch error, an empty body or a blank message', () => {
      expect(publicErrorMessage(new Error('boom'))).toBeNull();
      expect(publicErrorMessage(new PublicFetchError(500, {}))).toBeNull();
      expect(publicErrorMessage(new PublicFetchError(500, { message: '   ' }))).toBeNull();
      expect(publicErrorMessage(undefined)).toBeNull();
    });
  });
});
