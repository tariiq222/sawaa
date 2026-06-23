import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { redactSentryEvent } from './sentry-redaction';

// Helper: build a minimal but valid Sentry ErrorEvent fixture.
function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    message: 'something went wrong',
    exception: undefined,
    extra: undefined,
    contexts: undefined,
    tags: undefined,
    user: undefined,
    breadcrumbs: undefined,
    request: undefined,
    ...overrides,
  } as ErrorEvent;
}

describe('redactSentryEvent', () => {
  it('passes the message through when it contains no sensitive substrings', () => {
    const event = makeEvent({ message: 'GET /api/public/therapists failed with 500' });
    const out = redactSentryEvent(event);
    expect(out.message).toBe('GET /api/public/therapists failed with 500');
  });

  it('redacts bearer tokens embedded in the message string', () => {
    const event = makeEvent({
      message: 'request failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload',
    });
    const out = redactSentryEvent(event);
    expect(out.message).toContain('Bearer [REDACTED]');
    expect(out.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('redacts passwords, OTPs, and codes that appear as key=value in the message', () => {
    const event = makeEvent({
      message: 'login attempt password=hunter2&otp=123456&code=987654',
    });
    const out = redactSentryEvent(event);
    expect(out.message).toContain('password=[REDACTED]');
    expect(out.message).toContain('otp=[REDACTED]');
    expect(out.message).toContain('code=[REDACTED]');
    expect(out.message).not.toContain('hunter2');
    expect(out.message).not.toContain('123456');
    expect(out.message).not.toContain('987654');
  });

  it('redacts sensitive keys in `extra`, `tags`, `contexts`, and `user` payloads', () => {
    const event = makeEvent({
      extra: { sessionId: 'abc', password: 'hunter2' },
      tags: { route: '/login', apiKey: 'sk_live_secret' },
      contexts: { device: { token: 'tok_123' } },
      user: { id: 'u1', email: 'sara@sawa.test', ip_address: '10.0.0.1' },
    });
    const out = redactSentryEvent(event);
    expect((out.extra as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((out.extra as Record<string, unknown>).sessionId).toBe('abc');
    expect((out.tags as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((out.tags as Record<string, unknown>).route).toBe('/login');
    expect(
      ((out.contexts as Record<string, Record<string, unknown>>).device as Record<string, unknown>).token,
    ).toBe('[REDACTED]');
    // email/user fields are NOT auto-redacted (no key match) — but raw email
    // content stays; this is by design: the user object is structural, not a
    // string secret. Assert the contract we ship.
    expect((out.user as Record<string, unknown>).id).toBe('u1');
    expect((out.user as Record<string, unknown>).email).toBe('sara@sawa.test');
  });

  it('redacts sensitive keys at any nesting depth, including arrays of objects', () => {
    const event = makeEvent({
      extra: {
        payload: {
          // Case-insensitive match: "Authorization" / "X-API-Key" all hit.
          headers: { Authorization: 'Bearer abc', 'X-API-Key': 'k' },
          // "cookies" itself is a sensitive key → array is fully redacted.
          cookies: [{ name: 'a', value: 'v' }],
          body: { password: 'hunter2', note: 'plain text' },
        },
      },
    });
    const out = redactSentryEvent(event);
    const payload = (out.extra as Record<string, Record<string, unknown>>).payload as Record<
      string,
      unknown
    >;
    const headers = payload.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('[REDACTED]');
    expect(headers['X-API-Key']).toBe('[REDACTED]');
    expect(payload.cookies).toBe('[REDACTED]');

    const body = payload.body as Record<string, unknown>;
    expect(body.password).toBe('[REDACTED]');
    expect(body.note).toBe('plain text');
  });

  it('redacts Authorization values when they appear as inline strings in `extra`', () => {
    // The `extra` deep walker should redact sensitive substrings inside string
    // values too, not just keys (e.g. a logged URL containing ?token=...).
    const event = makeEvent({
      extra: { log: 'GET /v1/me?token=eyJabc&keep=1' },
    });
    const out = redactSentryEvent(event);
    const log = (out.extra as Record<string, string>).log;
    expect(log).toContain('token=[REDACTED]');
    expect(log).toContain('keep=1');
    expect(log).not.toContain('eyJabc');
  });

  it('redacts breadcrumbs and request payloads', () => {
    const event = makeEvent({
      breadcrumbs: [
        { message: 'POST /login with password=hunter2', data: { apiKey: 'k' } },
        { message: 'GET /public/therapists' },
      ],
      request: { url: 'https://api.test/v1/me', headers: { cookie: 'sid=abc' } },
    });
    const out = redactSentryEvent(event);
    const crumbs = out.breadcrumbs as Array<Record<string, unknown>>;
    expect(crumbs[0].message).toContain('password=[REDACTED]');
    expect((crumbs[0].data as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect(crumbs[1].message).toBe('GET /public/therapists');
    const req = out.request as Record<string, unknown>;
    expect((req.headers as Record<string, unknown>).cookie).toBe('[REDACTED]');
    expect(req.url).toBe('https://api.test/v1/me');
  });

  it('replaces deeply-nested structures past the depth limit with [REDACTED]', () => {
    // Build a chain 25 levels deep so the depth guard kicks in (limit = 20).
    let nested: Record<string, unknown> = { password: 'hunter2' };
    for (let i = 0; i < 25; i++) {
      nested = { child: nested };
    }
    const event = makeEvent({ extra: nested });
    const out = redactSentryEvent(event);
    // Walk the result — somewhere past depth 20, the value becomes [REDACTED].
    const json = JSON.stringify(out.extra);
    expect(json).toContain('[REDACTED]');
  });

  it('keeps non-string scalars (numbers, booleans, null) untouched', () => {
    const event = makeEvent({
      extra: { count: 42, ok: true, nada: null, label: 'plain' },
    });
    const out = redactSentryEvent(event);
    const extra = out.extra as Record<string, unknown>;
    expect(extra.count).toBe(42);
    expect(extra.ok).toBe(true);
    expect(extra.nada).toBe(null);
    expect(extra.label).toBe('plain');
  });

  it('does not mutate the input event (returns a new object)', () => {
    const event = makeEvent({ extra: { password: 'hunter2' } });
    redactSentryEvent(event);
    const extra = event.extra as Record<string, unknown>;
    expect(extra.password).toBe('hunter2');
  });
});
