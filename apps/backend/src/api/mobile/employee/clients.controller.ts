import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiOkResponse,
  ApiNotFoundResponse, ApiExtraModels, getSchemaPath,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListEmployeeClientsHandler } from '../../../modules/people/clients/list-employee-clients.handler';
import { GetEmployeeClientHistoryHandler } from '../../../modules/people/clients/get-employee-client-history.handler';
import { GetEmployeeClientHandler } from '../../../modules/people/clients/get-employee-client.handler';
import { ResolveEmployeeIdHandler } from '../../../modules/people/employees/resolve-employee-id.handler';
import { EmployeeClientResponseDto } from './dto/employee-client-response.dto';

export class EmployeeClientListQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  @ApiPropertyOptional({ description: 'Search by client name or phone', example: 'Sara' })
  @IsOptional() @IsString() search?: string;
}

@ApiTags('Mobile Employee / Clients')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(EmployeeClientResponseDto)
@UseGuards(JwtGuard, CaslGuard)
@Controller('mobile/employee/clients')
export class MobileEmployeeClientsController {
  constructor(
    private readonly resolveEmployeeId: ResolveEmployeeIdHandler,
    private readonly listEmployeeClients: ListEmployeeClientsHandler,
    private readonly getEmployeeClientHistory: GetEmployeeClientHistoryHandler,
    private readonly getEmployeeClient: GetEmployeeClientHandler,
  ) {}

  @CheckPermissions({ action: 'read', subject: 'Client' })
  @Get()
  @ApiOperation({ summary: "List the authenticated employee's clients" })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Search by client name or phone', example: 'Sara' })
  @ApiOkResponse({
    description: 'Paginated list of clients who have had bookings with this employee',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(EmployeeClientResponseDto) } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  })
  async listMyClients(
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeClientListQuery,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.listEmployeeClients.execute({
      employeeId,
      page,
      limit,
      search: q.search,
    });
  }

  @CheckPermissions({ action: 'read', subject: 'Client' })
  @Get(':clientId')
  @ApiOperation({ summary: "Get a client who has a booking with the authenticated employee" })
  @ApiParam({ name: 'clientId', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Employee-safe client record', type: EmployeeClientResponseDto })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async getMyClient(
    @CurrentUser() user: JwtUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.getEmployeeClient.execute({ employeeId, clientId });
  }

  @CheckPermissions({ action: 'read', subject: 'Client' })
  @Get(':clientId/history')
  @ApiOperation({ summary: "Get booking history for a client with the authenticated employee" })
  @ApiParam({ name: 'clientId', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'List of past bookings (up to 20, most recent first)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          scheduledAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', example: 'COMPLETED' },
          durationMins: { type: 'integer', example: 60 },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async clientHistory(
    @CurrentUser() user: JwtUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.getEmployeeClientHistory.execute({ employeeId, clientId });
  }
}
