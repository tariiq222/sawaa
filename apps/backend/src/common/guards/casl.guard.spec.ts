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

  it('should allow for super admin with manage all', () => {
    const handler = CheckPermissions({ action: 'manage', subject: 'all' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'all' }]);
    const user = { role: 'SUPER_ADMIN', customRole: null };
    expect(guard.canActivate(createContext(handler, user))).toBe(true);
  });

  it('should allow for owner with admin permissions', () => {
    const handler = CheckPermissions({ action: 'manage', subject: 'User' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'manage', subject: 'User' }]);
    const user = { role: 'OWNER', customRole: null };
    expect(guard.canActivate(createContext(handler, user))).toBe(true);
  });

  it('should throw for insufficient permissions', () => {
    const handler = CheckPermissions({ action: 'delete', subject: 'User' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'delete', subject: 'User' }]);
    const user = { role: 'RECEPTIONIST', customRole: null };
    expect(() => guard.canActivate(createContext(handler, user))).toThrow(ForbiddenException);
  });

  it('should allow when customRole has matching permission', () => {
    const handler = CheckPermissions({ action: 'read', subject: 'Booking' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'read', subject: 'Booking' }]);
    const user = { role: null, customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } };
    expect(guard.canActivate(createContext(handler, user))).toBe(true);
  });

  it('should throw when customRole lacks permission', () => {
    const handler = CheckPermissions({ action: 'update', subject: 'Booking' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([{ action: 'update', subject: 'Booking' }]);
    const user = { role: null, customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } };
    expect(() => guard.canActivate(createContext(handler, user))).toThrow(ForbiddenException);
  });
});
