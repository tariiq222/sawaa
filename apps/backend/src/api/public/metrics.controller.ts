import { Controller, Get, Header, Headers, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';

/**
 * SECURITY (P0-13): the Prometheus exposition endpoint is no longer public.
 * Operators must set `METRICS_TOKEN` (>= 32 chars random) and configure their
 * scraper with `Authorization: Bearer <token>`. If the env var is absent, the
 * endpoint refuses to serve metrics (fail-closed). Comparison uses
 * crypto.timingSafeEqual to avoid timing leaks.
 */
@ApiExcludeController()
@Controller('public/metrics')
export class PublicMetricsController {
  constructor(
    private readonly appMetrics: AppMetricsService,
    private readonly dbMetrics: DbMetricsService,
  ) {}

  @ApiOperation({ summary: 'Prometheus metrics exposition endpoint (requires Bearer METRICS_TOKEN)' })
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Headers('authorization') auth?: string): Promise<string> {
    const expected = process.env['METRICS_TOKEN'];
    if (!expected) {
      // Fail-closed: never expose metrics without an explicit operator opt-in.
      throw new ServiceUnavailableException('Metrics scraping not configured');
    }
    const presented = (auth ?? '').startsWith('Bearer ') ? (auth ?? '').slice(7) : '';
    if (!safeEqual(presented, expected)) {
      throw new UnauthorizedException('Invalid metrics token');
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
