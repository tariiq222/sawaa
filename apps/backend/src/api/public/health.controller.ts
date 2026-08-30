import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  getBuildMetadata,
  HealthCheckHandler,
  HealthCheckResult,
} from '../../modules/ops/health-check/health-check.handler';
import { isShuttingDown } from '../../common/shutdown.state';
import { Public } from '../../common/guards/jwt.guard';

@ApiTags('Public / Health')
@Public()
@Controller('health')
export class PublicHealthController {
  constructor(private readonly healthCheck: HealthCheckHandler) {}

  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness check — always returns 200 if the process is alive' })
  getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString(), ...getBuildMetadata() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — includes DB, Redis, queues' })
  @ApiOkResponse({ description: 'Health check result with per-service status' })
  async getReadiness(): Promise<HealthCheckResult> {
    if (isShuttingDown()) {
      throw new ServiceUnavailableException('Application is shutting down');
    }
    return this.healthCheck.execute();
  }

  @Get()
  @ApiOperation({ summary: 'Platform health check (DB, Redis, BullMQ)' })
  @ApiOkResponse({
    description: 'Health check result with per-service status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        version: { type: 'string', example: '2.1.9' },
        gitSha: { type: 'string', example: 'a1b2c3d' },
        db: { type: 'string', example: 'ok' },
        redis: { type: 'string', example: 'ok' },
        queue: { type: 'string', example: 'ok' },
      },
    },
  })
  check(): Promise<HealthCheckResult> {
    if (isShuttingDown()) {
      throw new ServiceUnavailableException('Application is shutting down');
    }
    return this.healthCheck.execute();
  }
}
