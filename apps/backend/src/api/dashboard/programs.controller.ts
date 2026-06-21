import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { CreateProgramHandler } from '../../modules/bookings/create-program/create-program.handler';
import { ListProgramsHandler } from '../../modules/bookings/list-programs/list-programs.handler';
import { GetProgramHandler } from '../../modules/bookings/get-program/get-program.handler';
import { PublishProgramHandler } from '../../modules/bookings/publish-program/publish-program.handler';
import { ScheduleProgramHandler } from '../../modules/bookings/schedule-program/schedule-program.handler';
import { CancelProgramHandler } from '../../modules/bookings/cancel-program/cancel-program.handler';
import { EnrollInProgramHandler } from '../../modules/bookings/enroll-in-program/enroll-in-program.handler';
import { CreateProgramDto } from '../../modules/bookings/create-program/create-program.dto';
import {
  CancelProgramDto,
  EnrollInProgramDto,
  ScheduleProgramDto,
} from '../../modules/bookings/enroll-in-program/enroll-in-program.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/programs')
export class DashboardProgramsController {
  constructor(
    private readonly createProgram: CreateProgramHandler,
    private readonly listPrograms: ListProgramsHandler,
    private readonly getProgram: GetProgramHandler,
    private readonly publishProgram: PublishProgramHandler,
    private readonly scheduleProgram: ScheduleProgramHandler,
    private readonly cancelProgram: CancelProgramHandler,
    private readonly enrollInProgram: EnrollInProgramHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new program (DRAFT)' })
  @ApiCreatedResponse({ description: 'Program created in DRAFT status' })
  async create(@Body() dto: CreateProgramDto) {
    return this.createProgram.execute({ ...dto, createdBy: 'dashboard' });
  }

  @Get()
  @ApiOperation({ summary: 'List programs (filterable by status, department, branch)' })
  @ApiOkResponse({ description: 'List of programs with computed isFull badge' })
  async list(
    @Query('status') status?: ProgramStatus,
    @Query('departmentId') departmentId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.listPrograms.execute({ status, departmentId, branchId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single program by UUID or numeric ref' })
  @ApiParam({ name: 'id', description: 'UUID or numeric ref' })
  @ApiOkResponse({ description: 'Program detail with enrollments and supervisors' })
  async getOne(@Param('id') id: string) {
    return this.getProgram.execute(id);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a DRAFT program (DRAFT → OPEN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.publishProgram.execute(id);
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Schedule a program (OPEN|MIN_REACHED → SCHEDULED)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleProgramDto,
  ) {
    return this.scheduleProgram.execute(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary:
      'Cancel a program (cascades to enrollments, no automatic refund)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelProgramDto,
  ) {
    return this.cancelProgram.execute(id, dto);
  }

  @Post(':id/enrollments')
  @ApiOperation({ summary: 'Enroll a client on-behalf from the dashboard' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollInProgramDto,
  ) {
    return this.enrollInProgram.execute({
      programId: id,
      clientId: dto.clientId,
    });
  }
}
