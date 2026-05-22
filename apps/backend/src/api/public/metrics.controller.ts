import {
  Controller,
  Get,
  Header,
  Headers,
  Req,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';

/**
 * SECURITY (P0-13): the Prometheus exposition endpoint is gated by both an
 * `INTERNAL_METRICS_TOKEN` (Bearer) and an `INTERNAL_METRICS_ALLOWED_IPS`
 * allowlist. Both are validated by `env.validation` in production. If the
 * token is missing the endpoint fail-closes (503) — operators must explicitly
 * configure scraping.
 *
 * Token comparison uses crypto.timingSafeEqual.
 * IP allowlist is enforced after token check so a wrong token returns 401
 * uniformly regardless of source IP.
 */
@ApiExcludeController()
@Controller('public/metrics')
export class PublicMetricsController {
  constructor(
    private readonly appMetrics: AppMetricsService,
    private readonly dbMetrics: DbMetricsService,
  ) {}

  @ApiOperation({
    summary:
      'Prometheus metrics exposition endpoint (requires Bearer INTERNAL_METRICS_TOKEN + IP allowlist)',
  })
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(
    @Headers('authorization') auth: string | undefined,
    @Req() req: Request,
  ): Promise<string> {
    const expected = process.env['INTERNAL_METRICS_TOKEN'];
    if (!expected || expected.length === 0) {
      throw new ServiceUnavailableException('Metrics scraping not configured');
    }
    const presented = (auth ?? '').startsWith('Bearer ') ? (auth ?? '').slice(7) : '';
    if (!safeEqual(presented, expected)) {
      throw new UnauthorizedException('Invalid metrics token');
    }

    // IP allowlist: only enforced if configured. `req.ip` respects
    // `trust proxy 1` (set in main.ts) so the X-Forwarded-For nearest hop wins.
    const allowed = (process.env['INTERNAL_METRICS_ALLOWED_IPS'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length > 0) {
      const source = req.ip ?? '';
      if (!allowed.includes(source)) {
        throw new UnauthorizedException('Source IP not in metrics allowlist');
      }
    }

    const [appOut, dbOut] = await Promise.all([
      this.appMetrics.registry.metrics(),
      this.dbMetrics.registry.metrics(),
    ]);
    return `${appOut}\n${dbOut}`;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
