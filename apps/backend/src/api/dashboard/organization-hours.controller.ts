import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { SetBusinessHoursHandler } from '../../modules/org-config/business-hours/set-business-hours.handler';
import { SetBusinessHoursDto } from '../../modules/org-config/business-hours/set-business-hours.dto';
import { GetBusinessHoursHandler } from '../../modules/org-config/business-hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/org-config/business-hours/add-holiday.handler';
import { AddHolidayDto } from '../../modules/org-config/business-hours/add-holiday.dto';
import { RemoveHolidayHandler } from '../../modules/org-config/business-hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/org-config/business-hours/list-holidays.handler';
import { ListHolidaysDto } from '../../modules/org-config/business-hours/list-holidays.dto';
import { HolidayRecordDto, OrganizationHoursRecordDto } from './dto/organization-hours-response.dto';

@ApiTags('Dashboard / Org Config')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationHoursController {
  constructor(
    private readonly setBusinessHours: SetBusinessHoursHandler,
    private readonly getBusinessHours: GetBusinessHoursHandler,
    private readonly addHoliday: AddHolidayHandler,
    private readonly removeHoliday: RemoveHolidayHandler,
    private readonly listHolidays: ListHolidaysHandler,
  ) {}

  @Post('hours')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Set business hours for a branch' })
  @ApiCreatedResponse({
    description: 'Business hours saved; the branch schedule after the upsert',
    type: OrganizationHoursRecordDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Branch not found', type: ApiErrorDto })
  setBusinessHoursEndpoint(@Body() body: SetBusinessHoursDto): Promise<OrganizationHoursRecordDto[]> {
    return this.setBusinessHours.execute(body);
  }

  @Get('hours/:branchId')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get business hours for a branch' })
  @ApiParam({ name: 'branchId', description: 'Branch ID', example: 'main-branch' })
  @ApiOkResponse({
    description: 'Business hours schedule',
    type: OrganizationHoursRecordDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Branch not found', type: ApiErrorDto })
  getBusinessHoursEndpoint(@Param('branchId') branchId: string): Promise<OrganizationHoursRecordDto[]> {
    return this.getBusinessHours.execute({ branchId });
  }

  @Post('holidays')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Add a holiday to a branch' })
  @ApiCreatedResponse({ description: 'Holiday added', type: HolidayRecordDto })
  @ApiResponse({ status: 404, description: 'Branch not found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'A holiday already exists for this branch and date', type: ApiErrorDto })
  addHolidayEndpoint(@Body() body: AddHolidayDto): Promise<HolidayRecordDto> {
    return this.addHoliday.execute(body);
  }

  @Delete('holidays/:holidayId')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a holiday' })
  @ApiParam({ name: 'holidayId', description: 'Holiday UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Holiday removed' })
  @ApiResponse({ status: 404, description: 'Holiday not found', type: ApiErrorDto })
  async removeHolidayEndpoint(@Param('holidayId', ParseUUIDPipe) holidayId: string): Promise<void> {
    await this.removeHoliday.execute({ holidayId });
  }

  @Get('holidays')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List holidays for a branch' })
  @ApiQuery({ name: 'branchId', required: true, description: 'Branch ID', example: 'main-branch' })
  // The previous snapshot documented `year` as `number`; keep that type and only
  // add the bounds the validator enforces.
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year', schema: { type: 'number', minimum: 2000, maximum: 3000, example: 2025 } })
  @ApiOkResponse({ description: 'List of holidays', type: HolidayRecordDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Branch not found', type: ApiErrorDto })
  listHolidaysEndpoint(@Query() query: ListHolidaysDto): Promise<HolidayRecordDto[]> {
    return this.listHolidays.execute(query);
  }
}
