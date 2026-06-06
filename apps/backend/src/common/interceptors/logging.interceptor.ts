import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { RequestContextStorage } from '../http/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const { method, path } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const context = RequestContextStorage.get();
          const ms = Date.now() - start;
          this.logger.log(
            `${method} ${path} ${res.statusCode} ${ms}ms` +
              (context ? ` reqId=${context.requestId}` : ''),
          );
        },
        error: (err: unknown) => {
          const context = RequestContextStorage.get();
          const ms = Date.now() - start;
          const status =
            err instanceof HttpException ? err.getStatus() : 500;
          const detail =
            err instanceof Error ? err.message : String(err);
          const reqId = context ? ` reqId=${context.requestId}` : '';
          this.logger.warn(
            `${method} ${path} ${status} ${ms}ms${reqId} — ${detail}`,
          );
        },
      }),
    );
  }
}
