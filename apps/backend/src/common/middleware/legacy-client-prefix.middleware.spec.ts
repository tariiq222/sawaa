import { EventEmitter } from 'events';
import { legacyClientPrefixMiddleware } from './legacy-client-prefix.middleware';

describe('legacyClientPrefixMiddleware', () => {
  const originalEnv = process.env.CLIENT_LEGACY_PREFIX_SUNSET;
  let inc: jest.Mock;
  let mw: ReturnType<typeof legacyClientPrefixMiddleware>;

  beforeEach(() => {
    delete process.env.CLIENT_LEGACY_PREFIX_SUNSET;
    inc = jest.fn();
    mw = legacyClientPrefixMiddleware({ legacyClientPrefixRequests: { inc } } as any);
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.CLIENT_LEGACY_PREFIX_SUNSET;
    else process.env.CLIENT_LEGACY_PREFIX_SUNSET = originalEnv;
  });

  function run(path: string, route?: string) {
    const headers: Record<string, string> = {};
    const res: any = new EventEmitter();
    res.setHeader = jest.fn((k: string, v: string) => { headers[k] = v; });
    const req: any = { path, route: route ? { path: route } : undefined };
    const next = jest.fn();
    mw(req, res, next);
    res.emit('finish');
    return { headers, next };
  }

  it('marks legacy mobile paths and counts with the route template', () => {
    const { headers, next } = run('/api/v1/mobile/client/bookings/abc', '/api/v1/mobile/client/bookings/:id');
    expect(next).toHaveBeenCalledTimes(1);
    expect(headers.Deprecation).toBe('true');
    expect(inc).toHaveBeenCalledWith({ prefix: 'mobile/client', route: '/api/v1/mobile/client/bookings/:id' });
  });

  it('marks legacy web paths', () => {
    const { headers } = run('/api/v1/public/me/bookings', '/api/v1/public/me/bookings');
    expect(headers.Deprecation).toBe('true');
    expect(inc).toHaveBeenCalledWith({ prefix: 'public/me', route: '/api/v1/public/me/bookings' });
  });

  it('falls back to the prefix when no route template exists', () => {
    run('/api/v1/public/me/unknown');
    expect(inc).toHaveBeenCalledWith({ prefix: 'public/me', route: 'public/me' });
  });

  it.each(['/api/v1/client/bookings', '/api/v1/public/services', '/api/v1/public/meetings', '/api/v1/mobile/clients'])(
    'leaves %s untouched',
    (path) => {
      const { headers, next } = run(path, path);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headers).toEqual({});
      expect(inc).not.toHaveBeenCalled();
    },
  );

  it('sets Sunset only for a valid env date', () => {
    process.env.CLIENT_LEGACY_PREFIX_SUNSET = '2027-03-01';
    expect(run('/api/v1/mobile/client/x').headers.Sunset).toBe('Mon, 01 Mar 2027 00:00:00 GMT');
    process.env.CLIENT_LEGACY_PREFIX_SUNSET = 'not-a-date';
    expect(run('/api/v1/mobile/client/x').headers.Sunset).toBeUndefined();
    delete process.env.CLIENT_LEGACY_PREFIX_SUNSET;
    expect(run('/api/v1/mobile/client/x').headers.Sunset).toBeUndefined();
  });
});
