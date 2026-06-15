import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  describe('buildFromPermissions', () => {
    it('grants each permission in the list', () => {
      const ability = factory.buildFromPermissions([
        { action: 'read', subject: 'Booking' },
        { action: 'update', subject: 'Client' },
      ]);
      expect(ability.can('read', 'Booking')).toBe(true);
      expect(ability.can('update', 'Client')).toBe(true);
    });

    it('does not grant permissions not in the list', () => {
      const ability = factory.buildFromPermissions([
        { action: 'read', subject: 'Booking' },
      ]);
      expect(ability.can('manage', 'Booking')).toBe(false);
      expect(ability.can('read', 'User')).toBe(false);
    });

    it('passes manage:all through unchanged — SUPER_ADMIN legitimately holds it', () => {
      // SUPER_ADMIN's req.user.permissions contains {manage, all} produced by
      // buildForUser inside JwtStrategy.  We must NOT filter it here.
      const ability = factory.buildFromPermissions([
        { action: 'manage', subject: 'all' },
      ]);
      expect(ability.can('manage', 'User')).toBe(true);
      expect(ability.can('read', 'Booking')).toBe(true);
      expect(ability.can('delete', 'Invoice')).toBe(true);
    });

    it('returns a deny-all ability for an empty list', () => {
      const ability = factory.buildFromPermissions([]);
      expect(ability.can('read', 'Booking')).toBe(false);
    });
  });

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  it('should give SUPER_ADMIN manage:all even without systemRolePermissions', () => {
    const ability = factory.buildForUser({
      role: 'SUPER_ADMIN',
      customRole: null,
      systemRolePermissions: null,
    });
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('should use BUILT_IN fallback for ADMIN when no systemRolePermissions', () => {
    const ability = factory.buildForUser({
      role: 'ADMIN',
      customRole: null,
      systemRolePermissions: null,
    });
    expect(ability.can('manage', 'User')).toBe(true);
  });

  it('should use systemRolePermissions from DB over BUILT_IN when provided', () => {
    const ability = factory.buildForUser({
      role: 'ADMIN',
      customRole: null,
      systemRolePermissions: [{ action: 'read', subject: 'Booking' }],
    });
    // DB-sourced: only read:Booking
    expect(ability.can('read', 'Booking')).toBe(true);
    // BUILT_IN would give manage:User, but DB rules override
    expect(ability.can('manage', 'User')).toBe(false);
  });

  it('should ignore wildcard permissions from systemRolePermissions (defense-in-depth)', () => {
    const ability = factory.buildForUser({
      role: 'ADMIN',
      customRole: null,
      systemRolePermissions: [{ action: 'manage', subject: 'all' }],
    });
    // Wildcard is filtered; fallback to empty (no BUILT_IN used when systemRolePermissions present)
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('should apply customRole permissions on top of system role permissions', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'manage', subject: 'Report' }] },
      systemRolePermissions: [{ action: 'read', subject: 'Booking' }],
    });
    expect(ability.can('manage', 'Report')).toBe(true);
    expect(ability.can('read', 'Booking')).toBe(true);
  });

  // P0-3 defense-in-depth: wildcard guard
  it('refuses customRole wildcard manage:all', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'manage', subject: 'all' }] },
    });
    expect(ability.can('manage', 'User')).toBe(false);
    expect(ability.can('manage', 'Setting')).toBe(false);
  });

  it('refuses customRole wildcard subject:all even for non-manage action', () => {
    const ability = factory.buildForUser({
      role: 'EMPLOYEE',
      customRole: { permissions: [{ action: 'read', subject: 'all' }] },
    });
    expect(ability.can('read', 'User')).toBe(false);
  });

  it('still grants legitimate customRole entries', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'read', subject: 'Report' }] },
    });
    expect(ability.can('read', 'Report')).toBe(true);
  });

  it('built-in SUPER_ADMIN keeps manage:all', () => {
    const ability = factory.buildForUser({ role: 'SUPER_ADMIN', customRole: null });
    expect(ability.can('manage', 'anything')).toBe(true);
  });

  describe('sensitive-money operations (R-16) are gated on manage:Setting', () => {
    it('OWNER and ADMIN hold manage:Setting (can approve refunds / rotate keys)', () => {
      for (const role of ['OWNER', 'ADMIN']) {
        const ability = factory.buildForUser({ role, customRole: null });
        expect(ability.can('manage', 'Setting')).toBe(true);
      }
    });

    it('ACCOUNTANT cannot manage Setting but keeps routine manage:Payment', () => {
      const ability = factory.buildForUser({ role: 'ACCOUNTANT', customRole: null });
      expect(ability.can('manage', 'Setting')).toBe(false);
      expect(ability.can('manage', 'Payment')).toBe(true);
      expect(ability.can('manage', 'Invoice')).toBe(true);
    });
  });

  // When DB systemRolePermissions are empty array (not null), treat as "no override"
  it('falls back to BUILT_IN when systemRolePermissions is empty array', () => {
    const ability = factory.buildForUser({
      role: 'ADMIN',
      customRole: null,
      systemRolePermissions: [],
    });
    // Empty array → condition `length > 0` is false → fallback to BUILT_IN
    expect(ability.can('manage', 'User')).toBe(true);
  });
});
