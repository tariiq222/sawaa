import { ForbiddenException } from '@nestjs/common';
import {
  ROLE_RANK,
  actorRankOf,
  targetRankOf,
  assertCanAssignRole,
  assertCanManageUser,
} from './role-rank';

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

    // A super admin is the ONLY actor allowed to grant SUPER_ADMIN. The first
    // guard vets that, and the "at or above your rank" guard carves this single
    // case out so another super admin can actually be minted. (Previously the
    // `<=` comparison caught 100 <= 100 and threw, making it impossible for
    // anyone — even a super admin — to grant SUPER_ADMIN.)
    it('allows a super admin to grant SUPER_ADMIN', () => {
      expect(() =>
        assertCanAssignRole({ role: 'SUPER_ADMIN', isSuperAdmin: true }, 'SUPER_ADMIN'),
      ).not.toThrow();
      // The super-admin lift also applies when the actor's built-in role is lower.
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: true }, 'SUPER_ADMIN'),
      ).not.toThrow();
    });

    // Regression: the SUPER_ADMIN carve-out must NOT leak into other roles. A
    // non-super-admin still cannot grant SUPER_ADMIN, and no actor may grant a
    // (non-SUPER_ADMIN) role at or above their own rank.
    it('still blocks granting any role at or above the actor rank (carve-out is SUPER_ADMIN-only)', () => {
      // Non-super-admin SUPER_ADMIN-by-role: blocked by the first guard.
      expect(() =>
        assertCanAssignRole({ role: 'SUPER_ADMIN', isSuperAdmin: false }, 'SUPER_ADMIN'),
      ).toThrow('Only super admins can grant SUPER_ADMIN');
      // Equal rank, non-SUPER_ADMIN target: still horizontal escalation.
      expect(() =>
        assertCanAssignRole({ role: 'ADMIN', isSuperAdmin: false }, 'ADMIN'),
      ).toThrow('Cannot assign a role at or above your rank');
      // Higher rank, non-SUPER_ADMIN target: still vertical escalation.
      expect(() =>
        assertCanAssignRole({ role: 'ACCOUNTANT', isSuperAdmin: false }, 'ADMIN'),
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

  describe('targetRankOf', () => {
    it('returns the table rank for a normal target', () => {
      expect(targetRankOf({ role: 'ADMIN', isSuperAdmin: false })).toBe(ROLE_RANK.ADMIN);
      expect(targetRankOf({ role: 'RECEPTIONIST', isSuperAdmin: false })).toBe(ROLE_RANK.RECEPTIONIST);
    });

    it('lifts a super-admin target to SUPER_ADMIN rank regardless of stored role', () => {
      expect(targetRankOf({ role: 'ADMIN', isSuperAdmin: true })).toBe(ROLE_RANK.SUPER_ADMIN);
      expect(targetRankOf({ role: 'EMPLOYEE', isSuperAdmin: true })).toBe(ROLE_RANK.SUPER_ADMIN);
    });
  });

  describe('assertCanManageUser', () => {
    const actor = (role: any, isSuperAdmin = false) => ({ id: 'actor', role, isSuperAdmin });
    const target = (role: any, isSuperAdmin = false) => ({ id: 'target', role, isSuperAdmin });

    it('allows a strictly higher-rank actor to manage a lower-rank target', () => {
      expect(() => assertCanManageUser(actor('ADMIN'), target('RECEPTIONIST'))).not.toThrow();
      expect(() => assertCanManageUser(actor('ACCOUNTANT'), target('EMPLOYEE'))).not.toThrow();
      expect(() => assertCanManageUser(actor('ADMIN', true), target('ADMIN'))).not.toThrow();
    });

    it('throws on EQUAL rank (horizontal escalation guard)', () => {
      expect(() => assertCanManageUser(actor('ADMIN'), target('ADMIN'))).toThrow(
        'Cannot modify a user at or above your rank',
      );
    });

    it('throws on HIGHER-rank target (vertical escalation guard)', () => {
      expect(() => assertCanManageUser(actor('RECEPTIONIST'), target('ADMIN'))).toThrow(
        ForbiddenException,
      );
    });

    it('throws when an ADMIN targets a SUPER_ADMIN (super-admin lift on target)', () => {
      expect(() => assertCanManageUser(actor('ADMIN'), target('ADMIN', true))).toThrow(
        ForbiddenException,
      );
    });

    it('throws on self-action even for a SUPER_ADMIN', () => {
      const self = { id: 'same', role: 'ADMIN' as const, isSuperAdmin: true };
      expect(() => assertCanManageUser(self, { ...self })).toThrow(
        'Cannot perform this action on your own account',
      );
    });
  });
});
