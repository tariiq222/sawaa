import { InternalBearerGuard } from './internal-bearer.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('InternalBearerGuard', () => {
  let guard: InternalBearerGuard;
  let mockConfig: { getOrThrow: jest.Mock };

  beforeEach(() => {
    mockConfig = { getOrThrow: jest.fn(() => 'secret-token') };
    guard = new InternalBearerGuard(mockConfig as any);
  });

  it('allows valid bearer token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer secret-token' },
        }),
      }),
    } as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks invalid bearer token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer wrong-token' },
        }),
      }),
    } as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('blocks missing bearer token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
