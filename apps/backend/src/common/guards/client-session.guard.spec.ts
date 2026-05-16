import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClientSessionGuard } from './client-session.guard';
import { ClsService } from 'nestjs-cls';

describe('ClientSessionGuard', () => {
  let guard: ClientSessionGuard;
  let cls: ClsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientSessionGuard,
        { provide: ClsService, useValue: { set: jest.fn() } },
      ],
    }).compile();

    guard = module.get<ClientSessionGuard>(ClientSessionGuard);
    cls = module.get<ClsService>(ClsService);
  });

  const createContext = (_client?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any);

  it('should throw on error', () => {
    expect(() => guard.handleRequest(new Error('fail'), null as any, null, createContext())).toThrow(UnauthorizedException);
  });

  it('should throw on no client', () => {
    expect(() => guard.handleRequest(null, null as any, null, createContext())).toThrow(UnauthorizedException);
  });

  it('should throw on client without id', () => {
    expect(() => guard.handleRequest(null, { organizationId: 'org' }, null, createContext())).toThrow(UnauthorizedException);
  });

  it('should throw on client without organizationId', () => {
    expect(() => guard.handleRequest(null, { id: 'c1' }, null, createContext())).toThrow(UnauthorizedException);
  });

  it('should return client and set cls', () => {
    const client = { id: 'c1', organizationId: 'org', role: 'CLIENT' };
    const result = guard.handleRequest(null, client, null, createContext());
    expect(result).toBe(client);
    expect(cls.set).toHaveBeenCalled();
  });

  it('should default role to CLIENT', () => {
    const client = { id: 'c1', organizationId: 'org' };
    guard.handleRequest(null, client, null, createContext());
    expect(cls.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ role: 'CLIENT' }),
    );
  });

  it('should call super.canActivate in canActivate', async () => {
    const superCanActivate = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate').mockResolvedValue(true);
    const result = await guard.canActivate(createContext());
    expect(result).toBe(true);
    expect(superCanActivate).toHaveBeenCalled();
  });
});
