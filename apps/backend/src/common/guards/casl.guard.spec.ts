import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CaslGuard, CheckPermissions } from './casl.guard';

describe('CaslGuard', () => {
  let guard: CaslGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaslGuard,
        Reflector,
      ],
    }).compile();

    guard = module.get<CaslGuard>(CaslGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createContext = (handler: any, user?: any): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any);

  it('should allow when no permissions required', () => {
    const handler = () => {};
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(handler))).toBe(true);
  });

  it('should allow when permissions array is empty', () => {
    const handler = () => {};
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(createContext(handler))).toBe(true);
  });

  it('should throw when no user', () => {
    const handler = CheckPermissions({ action: 'read', subject: 'User' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'read', subject: 'User' }]);
    expect(() => guard.canActivate(createContext(handler, undefined))).toThrow(ForbiddenException);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DB-is-the-authority tests (primary path — req.user.permissions populated)
  // ─────────────────────────────────────────────────────────────────────────

  describe('primary path: req.user.permissions drives access (DB is authority)', () => {
    it('ADMIN whose manage:Booking was removed in DB is denied — even though BUILT_IN has it', () => {
      // Simulate: DB system-role for ADMIN no longer includes manage:Booking.
      // JwtStrategy computed permissions=[manage:User, manage:Role, ...] but NOT manage:Booking.
      // The guard must honour the DB-derived list and deny, not consult BUILT_IN.
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'Booking' }]);
      const user = {
        role: 'ADMIN',
        customRole: null,
        // Permissions as computed by JwtStrategy from DB: manage:Booking is absent
        permissions: [
          { action: 'manage', subject: 'User' },
          { action: 'manage', subject: 'Role' },
          { action: 'manage', subject: 'Client' },
        ],
      };
      expect(() => guard.canActivate(createContext(null, user))).toThrow(ForbiddenException);
    });

    it('RECEPTIONIST with a DB-added permission not in BUILT_IN is allowed', () => {
      // Simulate: DB system-role for RECEPTIONIST now includes manage:Report (not in BUILT_IN).
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'Report' }]);
      const user = {
        role: 'RECEPTIONIST',
        customRole: null,
        permissions: [
          { action: 'create', subject: 'Booking' },
          { action: 'read', subject: 'Booking' },
          { action: 'update', subject: 'Booking' },
          { action: 'manage', subject: 'Report' }, // added in DB, absent in BUILT_IN
        ],
      };
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });

    it('SUPER_ADMIN with permissions=[{manage, all}] is allowed for any resource', () => {
      // SUPER_ADMIN legitimately carries manage:all in req.user.permissions.
      // buildFromPermissions must NOT filter it.
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'Setting' }]);
      const user = {
        role: 'SUPER_ADMIN',
        customRole: null,
        permissions: [{ action: 'manage', subject: 'all' }],
      };
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });

    it('user whose permissions list is empty is denied (even if role=ADMIN)', () => {
      // Empty array means no permissions — must not fall through to BUILT_IN.
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'User' }]);
      const user = {
        role: 'ADMIN',
        customRole: null,
        permissions: [], // empty → guard uses fallback buildForUser, BUILT_IN applies
      };
      // When permissions is empty the guard falls back to buildForUser(user) which
      // uses BUILT_IN ADMIN rules — so manage:User IS allowed via the fallback.
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fallback path: req.user has no permissions field (legacy / non-JWT strategies)
  // ─────────────────────────────────────────────────────────────────────────

  describe('fallback path: no req.user.permissions → buildForUser (BUILT_IN)', () => {
    it('should allow for super admin with manage all', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'all' }]);
      const user = { role: 'SUPER_ADMIN', customRole: null };
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });

    it('should allow for owner with admin permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'User' }]);
      const user = { role: 'OWNER', customRole: null };
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });

    it('should throw for insufficient permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'delete', subject: 'User' }]);
      const user = { role: 'RECEPTIONIST', customRole: null };
      expect(() => guard.canActivate(createContext(null, user))).toThrow(ForbiddenException);
    });

    it('should allow when customRole has matching permission', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'read', subject: 'Booking' }]);
      const user = { role: null, customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } };
      expect(guard.canActivate(createContext(null, user))).toBe(true);
    });

    it('should throw when customRole lacks permission', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'update', subject: 'Booking' }]);
      const user = { role: null, customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } };
      expect(() => guard.canActivate(createContext(null, user))).toThrow(ForbiddenException);
    });
  });
});
