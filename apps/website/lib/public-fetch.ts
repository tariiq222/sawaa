import { getApiBase } from './api-base';

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

let csrfBootstrap: Promise<string> | null = null;

export class PublicFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`PublicFetchError: ${status}`);
    this.name = 'PublicFetchError';
  }
}

/**
 * Utility for public website fetches (Sawa single-tenant):
 * 1. Prefixes the request with the API base (`/api/v1`).
 * 2. Throws `PublicFetchError(status, body)` on non-2xx.
 */
export async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const unsafe = isUnsafeMethod(init?.method);
  if (unsafe && !isBrowser()) {
    throw new PublicFetchError(0, { code: 'CSRF_BROWSER_REQUIRED' });
  }

  const token = unsafe ? await ensureCsrfToken(base) : null;
  return withRequestDeadline(init, (requestInit) =>
    executeRequest<T>(url, requestInit, token),
  );
}

async function executeRequest<T>(
  url: string,
  init: RequestInit,
  token: string | null,
): Promise<T> {
  let response = await sendRequest(url, init, token);
  const responseCsrfToken = readCsrfToken(response);

  if (!response.ok) {
    let errorBody = await readErrorBody(response);

    // CSRF rejects before reaching the handler, so one replay using the token
    // carried by that rejection cannot duplicate a completed mutation.
    if (
      isUnsafeMethod(init.method) &&
      response.status === 403 &&
      isCsrfInvalid(errorBody) &&
      isReplayableBody(init?.body) &&
      responseCsrfToken
    ) {
      response = await sendRequest(url, init, responseCsrfToken);
      if (!response.ok) {
        errorBody = await readErrorBody(response);
      }
    }

    if (!response.ok) {
      throw new PublicFetchError(response.status, errorBody);
    }
  }

  // 204 No Content (and other empty bodies) have nothing to parse — calling
  // response.json() on them throws. Return undefined to honour the T contract.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json().catch(() => undefined)) as T;
}

function isUnsafeMethod(method: string | undefined): boolean {
  return !SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body == null || typeof body === 'string') return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
    return true;
  }
  return false;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function ensureCsrfToken(base: string): Promise<string> {
  if (csrfBootstrap) return csrfBootstrap;

  csrfBootstrap = bootstrapCsrfToken(base).finally(() => {
    csrfBootstrap = null;
  });
  return csrfBootstrap;
}

async function bootstrapCsrfToken(base: string): Promise<string> {
  return withRequestDeadline(
    { method: 'GET', credentials: 'include' },
    async (init) => {
      const response = await fetch(`${base}/public/branding`, init);
      const token = readCsrfToken(response);
      if (token) return token;

      throw new PublicFetchError(response.status, { code: 'CSRF_BOOTSTRAP_FAILED' });
    },
  );
}

function readCsrfToken(response: Response): string | null {
  if (!isBrowser()) return null;
  const candidate = response.headers?.get(CSRF_HEADER_NAME);
  return candidate && CSRF_TOKEN_PATTERN.test(candidate) ? candidate : null;
}

function sendRequest(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init?.headers);
  // Only declare a JSON body when one is actually sent — bodyless GET/DELETE
  // requests must not advertise a Content-Type they don't carry.
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }

  const requestInit = { ...init, credentials: 'include' as const, headers };
  return fetch(url, requestInit);
}

async function withRequestDeadline<T>(
  init: RequestInit | undefined,
  operation: (init: RequestInit) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  let rejectDeadline!: (reason: unknown) => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const abort = (reason: unknown) => {
    const error = reason ?? new DOMException('Request aborted', 'AbortError');
    rejectDeadline(error);
    controller.abort(error);
  };
  const forwardCallerAbort = () => abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    forwardCallerAbort();
  } else {
    callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    abort(new DOMException('Request timed out', 'TimeoutError'));
  }, DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    // Keep the deadline alive through response-body consumption. Fetch itself
    // resolves after headers, while response.json()/blob() can still stall.
    return await Promise.race([
      operation({ ...init, signal: controller.signal }),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', forwardCallerAbort);
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function isCsrfInvalid(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'CSRF_INVALID'
  );
}
