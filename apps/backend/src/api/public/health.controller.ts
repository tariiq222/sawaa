import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiResponse, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  getBuildMetadata,
  HealthCheckHandler,
} from '../../modules/ops/health-check/health-check.handler';
import { isShuttingDown } from '../../common/shutdown.state';
import { Public } from '../../common/guards/jwt.guard';
import { ApiErrorDto } from '../../common/swagger';
import {
  HealthCheckResultDto,
  HealthLivenessResponseDto,
} from '../../common/swagger/health-response.dto';

@ApiTags('Public / Health')
@Public()
@Controller('health')
export class PublicHealthController {
  constructor(private readonly healthCheck: HealthCheckHandler) {}

  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness check — always returns 200 if the process is alive' })
  @ApiOkResponse({ type: HealthLivenessResponseDto, description: 'Process is alive; build metadata included' })
  @ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto })
  getLiveness(): HealthLivenessResponseDto {
    return { status: 'ok', timestamp: new Date().toISOString(), ...getBuildMetadata() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — includes DB, Redis, queues' })
  @ApiOkResponse({ type: HealthCheckResultDto, description: 'Health check result with per-service status' })
  @ApiResponse({ status: 503, description: 'Application is shutting down', type: ApiErrorDto })
  @ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto })
  async getReadiness(): Promise<HealthCheckResultDto> {
    if (isShuttingDown()) {
      throw new ServiceUnavailableException('Application is shutting down');
    }
    return this.healthCheck.execute();
  }

  @Get()
  @ApiOperation({ summary: 'Platform health check (DB, Redis, BullMQ)' })
  @ApiOkResponse({ type: HealthCheckResultDto, description: 'Health check result with per-service status' })
  @ApiResponse({ status: 503, description: 'Application is shutting down', type: ApiErrorDto })
  @ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto })
  check(): Promise<HealthCheckResultDto> {
    if (isShuttingDown()) {
      throw new ServiceUnavailableException('Application is shutting down');
    }
    return this.healthCheck.execute();
  }
}
