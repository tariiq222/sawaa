import { IpAllowlistGuard } from './ip-allowlist.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('IpAllowlistGuard', () => {
  let guard: IpAllowlistGuard;
  let mockConfig: { getOrThrow: jest.Mock };

  beforeEach(() => {
    mockConfig = { getOrThrow: jest.fn(() => '127.0.0.1,10.0.0.1') };
    guard = new IpAllowlistGuard(mockConfig as any);
  });

  it('allows whitelisted IP', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-real-ip': '127.0.0.1' },
          ip: '',
        }),
      }),
    } as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks non-whitelisted IP', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip: '192.168.1.1',
        }),
      }),
    } as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
