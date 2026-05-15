import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('logs successful requests', (done) => {
    const req = { method: 'GET', path: '/test' };
    const res = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => done(),
    });
  });

  it('logs error requests', (done) => {
    const req = { method: 'POST', path: '/test' };
    const res = { statusCode: 500 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => throwError(() => new Error('fail')) };

    interceptor.intercept(context, next).subscribe({
      error: () => done(),
    });
  });
});
