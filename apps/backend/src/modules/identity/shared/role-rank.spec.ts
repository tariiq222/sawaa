import { ForbiddenException } from '@nestjs/common';
import { ROLE_RANK, actorRankOf, assertCanAssignRole } from './role-rank';

/**
 * Privilege-escalation gate shared by every role-mutation path
 * (create-user, update-user-role, etc.). Defined once here so the rank
 * order is the single source of truth.
 *
 * NOTE: The test suite documents the CURRENT production behavior.
 * One test ("super admin trying to grant SUPER_ADMIN") flags a
 * contradiction between the two guards — see final report.
 */
describe('role-rank', () => {
  describe('ROLE_RANK', () => {
    it('orders built-in roles from least to most powerful', () => {
      expect(ROLE_RANK.CLIENT).toBeLessThan(ROLE_RANK.EMPLOYEE);
      expect(ROLE_RANK.EMPLOYEE).toBeLessThan(ROLE_RANK.RECEPTIONIST);
      expect(ROLE_RANK.RECEPTIONIST).toBeLessThan(ROLE_RANK.ACCOUNTANT);
      expect(ROLE_RANK.ACCOUNTANT).toBeLessThan(ROLE_RANK.ADMIN);
      expect(ROLE_RANK.ADMIN).toBeLessThan(ROLE_RANK.SUPER_ADMIN);
    });
  });

  describe('actorRankOf', () => {
    it('returns the table rank for a normal actor', () => {
      expect(actorRankOf({ role: 'ADMIN', isSuperAdmin: false })).toBe(ROLE_RANK.ADMIN);
      expect(actorRankOf({ role: 'CLIENT', isSuperAdmin: false })).toBe(ROLE_RANK.CLIENT);
      expect(actorRankOf({ role: 'EMPLOYEE', isSuperAdmin: false })).toBe(ROLE_RANK.EMPLOYEE);
    });

    it('lifts any actor with isSuperAdmin=true to the SUPER_ADMIN rank, regardless of role', () => {
      expect(actorRankOf({ role: 'ADMIN', isSuperAdmin: true })).toBe(ROLE_RANK.SUPER_ADMIN);
      expect(actorRankOf({ role: 'CLIENT', isSuperAdmin: true })).toBe(ROLE_RANK.SUPER_ADMIN);
      expect(actorRankOf({ role: 'RECEPTIONIST', isSuperAdmin: true })).toBe(ROLE_RANK.SUPER_ADMIN);
    });
  });

  describe('assertCanAssignRole', () => {
    it('allows a strictly lower rank to be granted', () => {
      // ADMIN (80) granting RECEPTIONIST (40) → ok
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: false }, 'RECEPTIONIST'),
      ).not.toThrow();
      // RECEPTIONIST (40) granting EMPLOYEE (30) → ok
      expect(() =>
        assertCanAssignRole({ role: 'RECEPTIONIST', isSuperAdmin: false }, 'EMPLOYEE'),
      ).not.toThrow();
      // ACCOUNTANT (50) granting CLIENT (10) → ok
      expect(() =>
        assertCanAssignRole({ role: 'ACCOUNTANT', isSuperAdmin: false }, 'CLIENT'),
      ).not.toThrow();
    });

    it('throws ForbiddenException on EQUAL rank (horizontal escalation guard)', () => {
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: false }, 'ADMIN'),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertCanAssignRole({ role: 'ACCOUNTANT', isSuperAdmin: false }, 'ACCOUNTANT'),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException on HIGHER rank (vertical escalation guard)', () => {
      // ADMIN (80) trying to grant SUPER_ADMIN (100) → must throw on rank
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: false }, 'SUPER_ADMIN'),
      ).toThrow('Only super admins can grant SUPER_ADMIN');
      // RECEPTIONIST (40) trying to grant ADMIN (80) → must throw on rank
      expect(() =>
        assertCanAssignRole({ role: 'RECEPTIONIST', isSuperAdmin: false }, 'ADMIN'),
      ).toThrow('Cannot assign a role at or above your rank');
    });

    it('throws when a non-super-admin tries to grant SUPER_ADMIN', () => {
      expect(() =>
        assertCanAssignRole({ role: 'SUPER_ADMIN', isSuperAdmin: false }, 'SUPER_ADMIN'),
      ).toThrow('Only super admins can grant SUPER_ADMIN');
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: false }, 'SUPER_ADMIN'),
      ).toThrow('Only super admins can grant SUPER_ADMIN');
      expect(() =>
        assertCanAssignRole({ role: 'CLIENT', isSuperAdmin: false }, 'SUPER_ADMIN'),
      ).toThrow('Only super admins can grant SUPER_ADMIN');
    });

    // BUG (see final report): the second guard's `<=` comparison catches
    // the SUPER_ADMIN→SUPER_ADMIN case (100 <= 100 is true) and throws,
    // even though the first guard's whole point is that a super admin is
    // the ONLY actor who may grant SUPER_ADMIN. So in production today,
    // no one — not even a super admin — can grant SUPER_ADMIN via this
    // helper. The test below documents current behavior; the production
    // unit must be patched (likely changing `<=` to `<`) before the
    // dashboard's role-management UI can ever create another super admin.
    it('CURRENTLY throws when a super admin tries to grant SUPER_ADMIN (BUG — see report)', () => {
      expect(() =>
        assertCanAssignRole({ role: 'SUPER_ADMIN', isSuperAdmin: true }, 'SUPER_ADMIN'),
      ).toThrow('Cannot assign a role at or above your rank');
    });

    it('allows a SUPER_ADMIN to grant any role strictly below theirs', () => {
      // isSuperAdmin lifts actor rank to 100 → every other rank is strictly lower
      expect(() =>
        assertCanAssignRole({ role: 'CLIENT', isSuperAdmin: true }, 'ADMIN'),
      ).not.toThrow();
      expect(() =>
        assertCanAssignRole({ role: 'EMPLOYEE', isSuperAdmin: true }, 'ACCOUNTANT'),
      ).not.toThrow();
      expect(() =>
        assertCanAssignRole({ role: 'RECEPTIONIST', isSuperAdmin: true }, 'RECEPTIONIST'),
      ).not.toThrow();
    });

    it('throws when an actor at the lowest rank tries to grant CLIENT (equal rank)', () => {
      // CLIENT (10) granting CLIENT (10) → equal rank → forbidden
      expect(() =>
        assertCanAssignRole({ role: 'CLIENT', isSuperAdmin: false }, 'CLIENT'),
      ).toThrow(ForbiddenException);
    });

    it('always throws ForbiddenException — never a generic Error or TypeError', () => {
      try {
        assertCanAssignRole({ role: 'CLIENT', isSuperAdmin: false }, 'ADMIN');
        fail('expected throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ForbiddenException);
      }
    });
  });
});
