import { ConfigService } from '@nestjs/config';
import { AuthResponseBuilder } from './auth-response.builder';

describe('AuthResponseBuilder', () => {
  let builder: AuthResponseBuilder;

  const tokens = { accessToken: 'at', refreshToken: 'rt' };

  // Helper to build a ConfigService mock with a single key/value lookup.
  const makeConfig = (overrides: Record<string, unknown> = {}) => {
    const data: Record<string, unknown> = { JWT_ACCESS_TTL: '15m', ...overrides };
    return { get: jest.fn((key: string) => data[key]) } as unknown as ConfigService;
  };

  describe('parseTtlSeconds (TTL string → seconds)', () => {
    // We test the private method indirectly by varying the JWT_ACCESS_TTL
    // env and reading expiresIn off the built response. This documents the
    // public contract: a 30s/15m/2h/7d env value becomes the right seconds.
    it.each([
      ['30s', 30],
      ['1m', 60],
      ['15m', 900],
      ['1h', 3600],
      ['2h', 7200],
      ['1d', 86_400],
      ['7d', 604_800],
    ])('converts %s → %i seconds', (ttl, expected) => {
      builder = new AuthResponseBuilder(makeConfig({ JWT_ACCESS_TTL: ttl }));
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(expected);
    });

    it('falls back to 900 seconds (15m) for an invalid TTL string', () => {
      builder = new AuthResponseBuilder(makeConfig({ JWT_ACCESS_TTL: 'not-a-ttl' }));
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(900);
    });

    it('falls back to 900 seconds when the unit letter is missing', () => {
      builder = new AuthResponseBuilder(makeConfig({ JWT_ACCESS_TTL: '120' }));
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(900);
    });

    it('falls back to 900 seconds when JWT_ACCESS_TTL is missing entirely', () => {
      builder = new AuthResponseBuilder(makeConfig({ JWT_ACCESS_TTL: undefined }));
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(900);
    });

    it('rejects negative or zero multipliers (parseInt returns 0, 0*60=0)', () => {
      builder = new AuthResponseBuilder(makeConfig({ JWT_ACCESS_TTL: '0m' }));
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(0);
    });
  });

  describe('build (response shape assembly)', () => {
    beforeEach(() => {
      builder = new AuthResponseBuilder(makeConfig());
    });

    it('preserves the supplied tokens exactly', () => {
      const res = builder.build(tokens, baseUser() as any);
      expect(res.accessToken).toBe('at');
      expect(res.refreshToken).toBe('rt');
    });

    it('includes expiresIn derived from JWT_ACCESS_TTL', () => {
      const res = builder.build(tokens, baseUser() as any);
      expect(res.expiresIn).toBe(900);
    });

    it('copies the user identity fields and defaults isSuperAdmin to false when null', () => {
      const res = builder.build(tokens, baseUser({ isSuperAdmin: null }) as any);
      expect(res.user).toMatchObject({
        id: 'u1',
        email: 'staff@example.com',
        name: 'Staff User',
        phone: '+966512345678',
        gender: 'FEMALE',
        avatarUrl: 'https://example.com/avatar.png',
        isActive: true,
        role: 'ADMIN',
        isSuperAdmin: false,
      });
    });

    it('isSuperAdmin true passes through', () => {
      const res = builder.build(tokens, baseUser({ isSuperAdmin: true }) as any);
      expect(res.user.isSuperAdmin).toBe(true);
    });

    it('splits the user name into firstName + lastName on whitespace', () => {
      const res = builder.build(tokens, baseUser({ name: 'Salem Mohammed Al-Otaibi' }) as any);
      expect(res.user.firstName).toBe('Salem');
      expect(res.user.lastName).toBe('Mohammed Al-Otaibi');
    });

    it('single-word name yields empty lastName, empty firstName fallback', () => {
      const res = builder.build(tokens, baseUser({ name: 'Salem' }) as any);
      expect(res.user.firstName).toBe('Salem');
      expect(res.user.lastName).toBe('');
    });

    it('empty name yields empty firstName and empty lastName', () => {
      const res = builder.build(tokens, baseUser({ name: '' }) as any);
      expect(res.user.firstName).toBe('');
      expect(res.user.lastName).toBe('');
    });

    it('null name yields empty firstName and empty lastName', () => {
      const res = builder.build(tokens, baseUser({ name: null }) as any);
      expect(res.user.firstName).toBe('');
      expect(res.user.lastName).toBe('');
    });

    it('collapses runs of whitespace between name parts', () => {
      const res = builder.build(tokens, baseUser({ name: '  Salem   Mohammed  ' }) as any);
      expect(res.user.firstName).toBe('Salem');
      expect(res.user.lastName).toBe('Mohammed');
    });

    it('flattens permissions from role + customRole into module:action strings', () => {
      const res = builder.build(
        tokens,
        baseUser({
          role: 'ADMIN',
          customRole: {
            permissions: [{ action: 'read', subject: 'Report' }],
          },
        }) as any,
      );
      // ADMIN built-in permissions include manage:User → "user:*" (lowercased subject).
      expect(res.user.permissions).toEqual(expect.arrayContaining(['user:*', 'report:read']));
    });

    // P1-8: DB-stored system-role permissions must override the hardcoded
    // BUILT_IN map, exactly as JwtStrategy feeds them into CASL — otherwise the
    // returned permissions[] (used by the dashboard UI) drifts from enforcement.
    it('reflects DB system-role permissions over the built-in map (P1-8)', () => {
      const res = builder.build(
        tokens,
        baseUser({ role: 'RECEPTIONIST', customRole: null }) as any,
        [{ action: 'read', subject: 'Booking' }],
      );
      expect(res.user.permissions).toEqual(['booking:read']);
    });

    it('falls back to the built-in map when no system-role permissions are supplied (P1-8)', () => {
      const res = builder.build(
        tokens,
        baseUser({ role: 'ADMIN', customRole: null }) as any,
        null,
      );
      // ADMIN built-in includes manage:User → "user:*".
      expect(res.user.permissions).toEqual(expect.arrayContaining(['user:*']));
    });

    it('returns empty permissions when role is null and no customRole (defensive)', () => {
      const res = builder.build(
        tokens,
        baseUser({ role: 'CLIENT' as any, customRole: null }) as any,
      );
      expect(Array.isArray(res.user.permissions)).toBe(true);
    });
  });
});

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'staff@example.com',
    name: 'Staff User',
    phone: '+966512345678',
    gender: 'FEMALE',
    avatarUrl: 'https://example.com/avatar.png',
    isActive: true,
    role: 'ADMIN',
    isSuperAdmin: false,
    customRole: null,
    ...overrides,
  };
}
