import { scrubEvent } from './instrument';

describe('scrubEvent', () => {
  it('strips query string from request URL using URL parser', () => {
    const event = {
      request: { url: 'https://example.com/path?token=secret&foo=bar' },
    };
    const result = scrubEvent(event);
    expect(result.request.url).toBe('https://example.com/path');
  });

  it('strips query string from path-only URL', () => {
    const event = {
      request: { url: '/api/v1/users?token=secret' },
    };
    const result = scrubEvent(event);
    expect(result.request.url).toBe('/api/v1/users');
  });

  it('does nothing when request.url is missing', () => {
    const event = { request: {} };
    const result = scrubEvent(event);
    expect(result.request.url).toBeUndefined();
  });

  it('does nothing when request is missing', () => {
    const event = {};
    const result = scrubEvent(event);
    expect(result.request).toBeUndefined();
  });

  it('redacts authorization header', () => {
    const event = {
      request: {
        headers: { Authorization: 'Bearer secret-token', 'X-Custom': 'keep' },
      },
    };
    const result = scrubEvent(event);
    expect(result.request.headers.Authorization).toBe('[redacted]');
    expect(result.request.headers['X-Custom']).toBe('keep');
  });

  it('redacts cookie header', () => {
    const event = {
      request: {
        headers: { cookie: 'session=abc', 'x-webhook-signature': 'sig' },
      },
    };
    const result = scrubEvent(event);
    expect(result.request.headers.cookie).toBe('[redacted]');
    expect(result.request.headers['x-webhook-signature']).toBe('[redacted]');
  });

  it('redacts x-*-signature headers', () => {
    const event = {
      request: {
        headers: { 'X-Webhook-Signature': 'sig123', 'X-Other': 'keep' },
      },
    };
    const result = scrubEvent(event);
    expect(result.request.headers['X-Webhook-Signature']).toBe('[redacted]');
    expect(result.request.headers['X-Other']).toBe('keep');
  });

  it('does nothing when headers is not an object', () => {
    const event = { request: { headers: null } };
    const result = scrubEvent(event);
    expect(result.request.headers).toBeNull();
  });

  it('scrubs sensitive fields from request data', () => {
    const event = {
      request: {
        data: {
          name: 'Alice',
          password: 'secret',
          nested: { apiKey: 'key123', cardNumber: '4111' },
        },
      },
    };
    const result = scrubEvent(event);
    expect(result.request.data.name).toBe('Alice');
    expect(result.request.data.password).toBe('[redacted]');
    expect(result.request.data.nested.apiKey).toBe('[redacted]');
    expect(result.request.data.nested.cardNumber).toBe('[redacted]');
  });

  it('scrubs sensitive fields from event.extra', () => {
    const event = {
      extra: {
        otp: '123456',
        nationalId: '1234567890',
        normalKey: 'keep',
      },
    };
    const result = scrubEvent(event);
    expect(result.extra.otp).toBe('[redacted]');
    expect(result.extra.nationalId).toBe('[redacted]');
    expect(result.extra.normalKey).toBe('keep');
  });

  it('does nothing when request.data is not an object', () => {
    const event = { request: { data: 'plain string' } };
    const result = scrubEvent(event);
    expect(result.request.data).toBe('plain string');
  });

  it('does nothing when extra is not an object', () => {
    const event = { extra: 'plain string' };
    const result = scrubEvent(event);
    expect(result.extra).toBe('plain string');
  });

  it('does nothing when request and extra are missing', () => {
    const event = { message: 'hello' };
    const result = scrubEvent(event);
    expect(result.message).toBe('hello');
  });
});
