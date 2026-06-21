import {
  Controller, Get, Post, Body, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery,
  ApiOkResponse, ApiCreatedResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { CreateGroupProgramHandler } from '../../modules/bookings/create-group-program/create-group-program.handler';
import { CreateGroupProgramDto } from '../../modules/bookings/create-group-program/create-group-program.dto';
import { ListGroupProgramsHandler } from '../../modules/bookings/list-group-programs/list-group-programs.handler';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/group-programs')
export class DashboardGroupProgramsController {
  constructor(
    private readonly createHandler: CreateGroupProgramHandler,
    private readonly listHandler: ListGroupProgramsHandler,
  ) {}

  @Post()
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a group program' })
  @ApiCreatedResponse({
    description: 'Group program created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        ref: { type: 'string', example: 'GP-1024' },
      },
    },
  })
  create(@Body() dto: CreateGroupProgramDto) {
    return this.createHandler.execute({ ...dto });
  }

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List group programs' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Return only active programs', example: true })
  @ApiQuery({ name: 'departmentId', required: false, type: String, description: 'Filter by department ID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({
    description: 'List of group programs',
    schema: { type: 'array', items: { type: 'object' } },
  })
  list(
    @Query('activeOnly') activeOnly?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.listHandler.execute({
      activeOnly: activeOnly === 'true',
      departmentId,
    });
  }
}
