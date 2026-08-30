import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let metrics: AppMetricsService;

  beforeEach(() => {
    metrics = new AppMetricsService();
    interceptor = new LoggingInterceptor(metrics);
  });

  it('logs successful requests and records bounded route metrics', async () => {
    const req = { method: 'GET', path: '/users/abc123?secret=x', route: { path: '/users/:id' } };
    const res = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe();

    const text = await metrics.registry.metrics();
    expect(text).toContain('http_requests_total{method="GET",route="/users/:id",status_class="2xx"} 1');
    expect(text).toContain('http_request_duration_seconds_count{method="GET",route="/users/:id",status_class="2xx"} 1');
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('secret=x');
    expect(text).toContain('http_requests_in_flight{method="GET",route="/users/:id",status_class="in_flight"} 0');
  });

  it('records error requests and decrements in-flight metrics', async () => {
    const req = { method: 'POST', path: '/users/abc123', route: { path: '/users/:id' } };
    const res = { statusCode: 500 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => throwError(() => new Error('fail')) };

    interceptor.intercept(context, next).subscribe({ error: () => undefined });

    const text = await metrics.registry.metrics();
    expect(text).toContain('http_requests_total{method="POST",route="/users/:id",status_class="5xx"} 1');
    expect(text).toContain('http_requests_in_flight{method="POST",route="/users/:id",status_class="in_flight"} 0');
    expect(text).not.toContain('abc123');
  });

  it('records empty completions once with the final response status', async () => {
    const req = { method: 'GET', path: '/empty', route: { path: '/empty' } };
    const res = { statusCode: 204 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const next: CallHandler = { handle: () => EMPTY };

    interceptor.intercept(context, next).subscribe();

    const text = await metrics.registry.metrics();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/empty",status_class="2xx"} 1',
    );
    expect(text).toContain(
      'http_request_duration_seconds_count{method="GET",route="/empty",status_class="2xx"} 1',
    );
    expect(text).toContain(
      'http_requests_in_flight{method="GET",route="/empty",status_class="in_flight"} 0',
    );
  });

  it('keeps requests in flight until the handler completes', async () => {
    const req = { method: 'GET', path: '/slow/abc123', route: { path: '/slow/:id' } };
    const res = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;
    let complete!: () => void;
    const next: CallHandler = {
      handle: () =>
        new Observable<string>((subscriber) => {
          complete = () => {
            subscriber.next('result');
            subscriber.complete();
          };
        }),
    };

    interceptor.intercept(context, next).subscribe();
    expect(metrics.registry.getSingleMetric('http_requests_in_flight')).toBeDefined();
    expect((await metrics.registry.metrics())).toContain('http_requests_in_flight{method="GET",route="/slow/:id",status_class="in_flight"} 1');

    complete();
    expect((await metrics.registry.metrics())).toContain('http_requests_in_flight{method="GET",route="/slow/:id",status_class="in_flight"} 0');
  });
});
