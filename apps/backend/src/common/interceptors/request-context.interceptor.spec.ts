import { RequestContextInterceptor } from './request-context.interceptor';
import { of } from 'rxjs';
import { RequestContextStorage } from '../http/request-context';

describe('RequestContextInterceptor', () => {
  let interceptor: RequestContextInterceptor;

  beforeEach(() => {
    interceptor = new RequestContextInterceptor();
  });

  it('seeds context with x-request-id', (done) => {
    const req = {
      headers: { 'x-request-id': 'req-123' },
      user: { sub: 'u1' },
      ip: '127.0.0.1',
      socket: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
    const next = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        const ctx = RequestContextStorage.get();
        expect(ctx?.requestId).toBe('req-123');
        expect(ctx?.userId).toBe('u1');
        expect(ctx?.ip).toBe('127.0.0.1');
        done();
      },
    });
  });

  it('generates random uuid when no x-request-id', (done) => {
    const req = {
      headers: {},
      user: undefined,
      ip: undefined,
      socket: { remoteAddress: '::1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
    const next = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        const ctx = RequestContextStorage.get();
        expect(ctx?.requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(ctx?.userId).toBeUndefined();
        expect(ctx?.ip).toBe('::1');
        done();
      },
    });
  });
});
