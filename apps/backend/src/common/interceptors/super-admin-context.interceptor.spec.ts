import { SuperAdminContextInterceptor } from './super-admin-context.interceptor';
import { ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';

describe('SuperAdminContextInterceptor', () => {
  let interceptor: SuperAdminContextInterceptor;
  let mockCls: any;

  beforeEach(() => {
    mockCls = { set: jest.fn() };
    interceptor = new SuperAdminContextInterceptor(mockCls);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('blocks impersonation scope', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { scope: 'impersonation' } }),
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => of('result') };

    expect(() => interceptor.intercept(context, next)).toThrow(ForbiddenException);
  });

  it('allows normal requests', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: {} }),
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockCls.set).toHaveBeenCalled();
        done();
      },
    });
  });
});
