import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response shapes for the public health routes in
 * `src/api/public/health.controller.ts`.
 *
 * Documentation only: the controller composes these objects inline and keeps
 * its inferred return types, so nothing here shapes a response.
 * `client-response.dto.spec.ts` pins the classes to `HealthCheckResult` and to
 * the liveness object the controller returns.
 */

/** `GET /health/live` — liveness payload. */
export class HealthLivenessResponseDto {
  @ApiProperty({ enum: ['ok'], description: 'Process liveness marker', example: 'ok' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Instant the probe was answered', example: '2026-05-20T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ description: 'Running application version (APP_VERSION, package version, or "unknown")', example: '2.2.0' })
  version!: string;

  @ApiProperty({ description: 'Deployed git SHA (GIT_SHA), or "unknown" when unset', example: 'a1b2c3d' })
  gitSha!: string;
}

/** One named health indicator result (Terminus shape), as documented on the wire. */
export class HealthIndicatorResultDto {
  @ApiProperty({ enum: ['up', 'down'], description: 'Indicator status', example: 'up' })
  status!: string;

  @ApiPropertyOptional({ description: 'Failure message when the indicator is down', example: 'Redis unreachable' })
  message?: string;
}

/**
 * `GET /health` and `GET /health/ready` — Terminus `HealthCheckResult` merged
 * with build metadata (`{ ...result, version, gitSha }`). The indicator maps
 * are keyed by indicator name (database, redis, queue, minio). The handler's
 * own `HealthCheckResult` interface declares an open index signature on each
 * indicator, so the field types below mirror it exactly.
 */
@ApiExtraModels(HealthIndicatorResultDto)
export class HealthCheckResultDto {
  @ApiProperty({ enum: ['ok', 'error'], description: 'Aggregate health status', example: 'ok' })
  status!: 'ok' | 'error';

  @ApiProperty({ description: 'Running application version', example: '2.2.0' })
  version!: string;

  @ApiProperty({ description: 'Deployed git SHA, or "unknown" when unset', example: 'a1b2c3d' })
  gitSha!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'Results of the healthy indicators, keyed by name',
    example: { database: { status: 'up' }, redis: { status: 'up' }, queue: { status: 'up' }, minio: { status: 'up' } },
  })
  info!: Record<string, { status: string; [key: string]: unknown }>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'Failed indicators, keyed by name; empty when healthy',
    example: {},
  })
  error!: Record<string, { status: string; message?: string }>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorResultDto' },
    description: 'All indicator results, keyed by name',
    example: { database: { status: 'up' }, redis: { status: 'up' }, queue: { status: 'up' }, minio: { status: 'up' } },
  })
  details!: Record<string, { status: string; [key: string]: unknown }>;
}
