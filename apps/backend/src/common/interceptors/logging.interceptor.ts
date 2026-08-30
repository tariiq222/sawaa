import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RequestContextStorage } from '../http/request-context';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: AppMetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const { method, path } = req;
    const route = routeTemplate(req);
    const metricMethod = method.toUpperCase();
    const start = Date.now();
    const inFlightLabels = {
      method: metricMethod,
      route,
      status_class: 'in_flight',
    } as const;
    this.metrics.httpRequestsInFlight.inc(inFlightLabels);

    let metricsRecorded = false;
    const recordMetrics = (status: number): void => {
      if (metricsRecorded) return;
      metricsRecorded = true;
      const labels = {
        method: metricMethod,
        route,
        status_class: statusClass(status),
      } as const;
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpRequestDuration.observe(labels, (Date.now() - start) / 1000);
    };

    return next.handle().pipe(
      tap({
        next: () => {
          recordMetrics(res.statusCode);
          const context = RequestContextStorage.get();
          const ms = Date.now() - start;
          this.logger.log(
            `${method} ${path} ${res.statusCode} ${ms}ms` +
              (context ? ` reqId=${context.requestId}` : ''),
          );
        },
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          recordMetrics(status);
          const context = RequestContextStorage.get();
          const ms = Date.now() - start;
          const detail =
            err instanceof Error ? err.message : String(err);
          const reqId = context ? ` reqId=${context.requestId}` : '';
          this.logger.warn(
            `${method} ${path} ${status} ${ms}ms${reqId} — ${detail}`,
          );
        },
      }),
      finalize(() => {
        // A normal HTTP handler emits once, but recording here also covers an
        // empty completion while ensuring the active gauge always decreases.
        if (!metricsRecorded) recordMetrics(res.statusCode);
        this.metrics.httpRequestsInFlight.dec(inFlightLabels);
      }),
    );
  }
}

/** Returns only Express's registered route template, never the request path. */
function routeTemplate(req: Request): string {
  return typeof req.route?.path === 'string' && req.route.path.length > 0
    ? req.route.path
    : 'unmatched';
}

function statusClass(status: number): string {
  return status >= 100 && status < 600 ? `${Math.floor(status / 100)}xx` : '5xx';
}
