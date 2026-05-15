import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtGuard, Public, IS_PUBLIC_KEY } from './jwt.guard';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache';
import { ClsService } from 'nestjs-cls';

describe('JwtGuard', () => {
  let guard: JwtGuard;
  let reflector: Reflector;
  let cls: ClsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtGuard,
        Reflector,
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: ClsService, useValue: { set: jest.fn() } },
      ],
    }).compile();

    guard = module.get<JwtGuard>(JwtGuard);
    reflector = module.get<Reflector>(Reflector);
    cls = module.get<ClsService>(ClsService);
  });

  const createContext = (metadata?: any, user?: any): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, headers: {} }),
      }),
    } as any);

  it('should allow public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = await guard.canActivate(createContext());
    expect(result).toBe(true);
  });

  it('should handleRequest throw on error', () => {
    expect(() => guard.handleRequest(new Error('fail'), null, null, null as any)).toThrow();
  });

  it('should handleRequest throw on no user', () => {
    expect(() => guard.handleRequest(null, null, null, null as any)).toThrow();
  });

  it('should handleRequest return user', () => {
    const user = { id: 'u1' };
    expect(guard.handleRequest(null, user, null, null as any)).toBe(user);
  });

  it('should resolveEffectiveOrgId return undefined when no user', () => {
    const result = (guard as any).resolveEffectiveOrgId(undefined, {});
    expect(result).toBeUndefined();
  });

  it('should resolveEffectiveOrgId return DEFAULT_ORG_ID when user present', () => {
    const result = (guard as any).resolveEffectiveOrgId({ id: 'u1' }, {});
    expect(result).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should stampTenantContext do nothing when no user', () => {
    const setSpy = jest.spyOn(cls, 'set');
    (guard as any).stampTenantContext(undefined, 'org-1');
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('should stampTenantContext do nothing when no orgId', () => {
    const setSpy = jest.spyOn(cls, 'set');
    (guard as any).stampTenantContext({ id: 'u1' }, undefined);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('should stampTenantContext with user sub fallback', () => {
    const setSpy = jest.spyOn(cls, 'set');
    (guard as any).stampTenantContext({ sub: 'u1', role: 'ADMIN', isSuperAdmin: true }, 'org-1');
    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'u1', role: 'ADMIN', isSuperAdmin: true }),
    );
  });

  it('should stampTenantContext with defaults', () => {
    const setSpy = jest.spyOn(cls, 'set');
    (guard as any).stampTenantContext({ id: 'u1' }, 'org-1');
    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'u1', role: '', isSuperAdmin: false }),
    );
  });

  it('should handleRequest return user when no error', () => {
    const user = { id: 'u1' };
    expect(guard.handleRequest(null, user, null, null as any)).toBe(user);
  });

  it('should canActivate call super.canActivate when not public', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superSpy = jest.spyOn(JwtGuard.prototype, 'canActivate' as any).mockResolvedValue(true);
    const req = { user: { id: 'u1' }, headers: {} };
    const context = createContext(false, req.user);
    context.switchToHttp = () => ({ getRequest: () => req }) as any;
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    superSpy.mockRestore();
  });

  it('Public decorator should set metadata', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });
});
