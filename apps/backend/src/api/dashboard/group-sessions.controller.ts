import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse, ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions, CaslGuard } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { CreateGroupSessionHandler } from '../../modules/bookings/create-group-session/create-group-session.handler';
import { CreateGroupSessionDto } from '../../modules/bookings/create-group-session/create-group-session.dto';
import { ListGroupSessionsHandler } from '../../modules/bookings/list-group-sessions/list-group-sessions.handler';
import { ListGroupSessionsDto } from '../../modules/bookings/list-group-sessions/list-group-sessions.dto';
import { GetGroupSessionHandler } from '../../modules/bookings/get-group-session/get-group-session.handler';
import { CancelGroupSessionHandler } from '../../modules/bookings/cancel-group-session/cancel-group-session.handler';
import { CancelGroupSessionDto } from '../../modules/bookings/cancel-group-session/cancel-group-session.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/group-sessions')
export class DashboardGroupSessionsController {
  constructor(
    private readonly createHandler: CreateGroupSessionHandler,
    private readonly listHandler: ListGroupSessionsHandler,
    private readonly getHandler: GetGroupSessionHandler,
    private readonly cancelHandler: CancelGroupSessionHandler,
  ) {}

  @Post()
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a group session' })
  @ApiCreatedResponse({
    description: 'Group session created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'OPEN' },
        scheduledAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  create(@Body() dto: CreateGroupSessionDto) {
    return this.createHandler.execute({
      ...dto,
      scheduledAt: new Date(dto.scheduledAt),
    });
  }

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List group sessions' })
  @ApiOkResponse({
    description: 'Paginated list of group sessions',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  list(@Query() dto: ListGroupSessionsDto) {
    return this.listHandler.execute({
      ...dto,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    });
  }

  @Get(':id')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get a group session by ID' })
  @ApiParam({ name: 'id', description: 'Group session UUID', type: 'string', format: 'uuid' })
  @ApiOkResponse({
    description: 'Group session details including enrollments',
    schema: { type: 'object' },
  })
  @ApiResponse({ status: 404, description: 'Group session not found' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getHandler.execute({ groupSessionId: id });
  }

  @Patch(':id/cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Cancel a group session' })
  @ApiParam({ name: 'id', description: 'Group session UUID', type: 'string', format: 'uuid' })
  @ApiOkResponse({
    description: 'Group session cancelled',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'CANCELLED' },
        cancelledAt: { type: 'string', format: 'date-time' },
        cancelReason: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Group session not found' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelGroupSessionDto,
  ) {
    return this.cancelHandler.execute({ ...dto, groupSessionId: id });
  }
}
