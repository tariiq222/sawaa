import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { RequestContextStorage } from '../http/request-context';

/**
 * Seeds AsyncLocalStorage with a request-scoped context so that
 * requestId, userId, and IP are available downstream in:
 * - LoggingInterceptor
 * - HttpExceptionFilter
 * - AuditInterceptor
 * - Sentry scopes
 *
 * Reads X-Request-ID from the incoming request header, or generates
 * a random UUID if absent. Must be registered BEFORE LoggingInterceptor
 * and AuditInterceptor in the global interceptor chain.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || randomUUID();
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    const ip = req.ip ?? req.socket?.remoteAddress;

    return new Observable((subscriber) => {
      RequestContextStorage.run(
        { requestId, userId, ip },
        () => {
          next.handle().subscribe(subscriber);
        },
      );
    });
  }
}
