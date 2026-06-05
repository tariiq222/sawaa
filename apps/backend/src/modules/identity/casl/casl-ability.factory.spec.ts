import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory (P0-3)', () => {
  const factory = new CaslAbilityFactory();

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

  it('merges built-in role rules even when customRole is set', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'read', subject: 'Report' }] },
    });
    expect(ability.can('read', 'Booking')).toBe(true);
    expect(ability.can('read', 'Report')).toBe(true);
  });

  it('built-in SUPER_ADMIN keeps manage:all', () => {
    const ability = factory.buildForUser({ role: 'SUPER_ADMIN', customRole: null });
    expect(ability.can('manage', 'anything')).toBe(true);
  });

  describe('sensitive-money operations (R-16) are gated on manage:Setting', () => {
    // Refund approve/deny + direct refund + Moyasar key rotation are guarded by
    // manage:Setting. OWNER/ADMIN hold it; ACCOUNTANT must not.
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
});
