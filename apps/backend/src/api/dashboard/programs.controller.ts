import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import {
  ProgramListItemResponseDto,
  ProgramPublishResponseDto,
  ProgramScheduleResponseDto,
  ProgramWriteResponseDto,
} from './dto/program-response.dto';
import { ProgramCancellationPreviewDto, ProgramCancellationResultDto } from '../../modules/bookings/cancel-program/program-cancellation.dto';
import { UserId } from '../../common/auth/user-id.decorator';
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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { CreateProgramHandler } from '../../modules/bookings/create-program/create-program.handler';
import { UpdateProgramHandler } from '../../modules/bookings/update-program/update-program.handler';
import { ListProgramsHandler } from '../../modules/bookings/list-programs/list-programs.handler';
import { GetProgramHandler } from '../../modules/bookings/get-program/get-program.handler';
import { PublishProgramHandler } from '../../modules/bookings/publish-program/publish-program.handler';
import { ScheduleProgramHandler } from '../../modules/bookings/schedule-program/schedule-program.handler';
import { CancelProgramHandler } from '../../modules/bookings/cancel-program/cancel-program.handler';
import { EnrollInProgramHandler } from '../../modules/bookings/enroll-in-program/enroll-in-program.handler';
import { CreateProgramDto } from '../../modules/bookings/create-program/create-program.dto';
import { UpdateProgramDto } from '../../modules/bookings/update-program/update-program.dto';
import {
  CancelProgramDto,
  EnrollClientDto,
  ScheduleProgramDto,
} from '../../modules/bookings/enroll-in-program/enroll-in-program.dto';

@ApiTags('Dashboard / Programs')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/programs')
export class DashboardProgramsController {
  constructor(
    private readonly createProgram: CreateProgramHandler,
    private readonly updateProgram: UpdateProgramHandler,
    private readonly listPrograms: ListProgramsHandler,
    private readonly getProgram: GetProgramHandler,
    private readonly publishProgram: PublishProgramHandler,
    private readonly scheduleProgram: ScheduleProgramHandler,
    private readonly cancelProgram: CancelProgramHandler,
    private readonly enrollInProgram: EnrollInProgramHandler,
  ) {}

  @Post()
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a new program (DRAFT)' })
  @ApiCreatedResponse({ description: 'Program created in DRAFT status', type: ProgramWriteResponseDto })
  @ApiResponse({ status: 404, description: 'Department, branch or supervisor not found' })
  async create(@Body() dto: CreateProgramDto): Promise<ProgramWriteResponseDto> {
    return this.createProgram.execute({ ...dto, createdBy: 'dashboard' });
  }

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List programs (filterable by status, department, branch)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by program lifecycle status', enum: ProgramStatus, example: 'OPEN' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filter by owning department', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'List of programs with computed isFull badge', type: ProgramListItemResponseDto, isArray: true })
  async list(
    @Query('status') status?: ProgramStatus,
    @Query('departmentId') departmentId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ProgramListItemResponseDto[]> {
    return this.listPrograms.execute({ status, departmentId, branchId });
  }

  @Get(':id')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get a single program by UUID or numeric ref' })
  @ApiParam({ name: 'id', description: 'UUID or numeric ref' })
  @ApiOkResponse({ description: 'Program detail with enrollments and supervisors', type: ProgramDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async getOne(@Param('id') id: string): Promise<ProgramDetailResponseDto> {
    return this.getProgram.execute(id);
  }

  @Patch(':id')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Update an existing program (DRAFT|OPEN|MIN_REACHED|SCHEDULED)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Program identity and resulting lifecycle state', type: ProgramWriteResponseDto })
  @ApiResponse({ status: 404, description: 'Program, department, branch or supervisor not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ): Promise<ProgramWriteResponseDto> {
    return this.updateProgram.execute(id, dto);
  }

  @Patch(':id/publish')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Publish a DRAFT program (DRAFT → OPEN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Program identity and resulting lifecycle status', type: ProgramPublishResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<ProgramPublishResponseDto> {
    return this.publishProgram.execute(id);
  }

  @Patch(':id/schedule')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Schedule a program (OPEN|MIN_REACHED → SCHEDULED)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Program identity, resulting lifecycle status and start instant', type: ProgramScheduleResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleProgramDto,
  ): Promise<ProgramScheduleResponseDto> {
    return this.scheduleProgram.execute(id, dto);
  }

  @Get(':id/cancellation-preview')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Preview participant refunds for center cancellation' })
  @ApiOkResponse({ type: ProgramCancellationPreviewDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancellationPreview(@Param('id', ParseUUIDPipe) id: string): Promise<ProgramCancellationPreviewDto> {
    return this.cancelProgram.preview(id);
  }

  @Patch(':id/cancel')
  @ApiOkResponse({ type: ProgramCancellationResultDto })
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({
    summary:
      'Cancel a program and queue participant refunds from the confirmed preview',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelProgramDto,
    @UserId() userId: string,
  ) {
    return this.cancelProgram.execute(id, dto, userId);
  }

  @Post(':id/enrollments')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Enroll a client on-behalf from the dashboard' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollClientDto,
  ) {
    return this.enrollInProgram.execute({
      programId: id,
      clientId: dto.clientId,
    });
  }
}
