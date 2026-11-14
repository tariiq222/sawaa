import { OrganizationRatingsResponseDto } from './dto/organization-ratings-response.dto';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { SubmitRatingDto } from '../../modules/org-experience/ratings/submit-rating.dto';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { ListRatingsDto } from '../../modules/org-experience/ratings/list-ratings.dto';
import { UpdateRatingVisibilityHandler } from '../../modules/org-experience/ratings/update-rating-visibility.handler';
import { UpdateRatingVisibilityDto } from '../../modules/org-experience/ratings/update-rating-visibility.dto';
import { GetOrgSettingsHandler } from '../../modules/org-experience/org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from '../../modules/org-experience/org-settings/upsert-org-settings.handler';
import { UpsertOrgSettingsDto } from '../../modules/org-experience/org-settings/upsert-org-settings.dto';
import { GetBookingSettingsHandler } from '../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { UpsertBookingSettingsDto } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.dto';
import {
  BankTransferAccountResponseDto,
  BookingSettingsRecordResponseDto,
  BookingSettingsValuesDto,
  OrganizationRatingRecordResponseDto,
  OrganizationRatingVisibilityResponseDto,
  OrganizationSettingsResponseDto,
} from './dto/organization-settings-response.dto';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  BankTransferAccountResponseDto,
  OrganizationSettingsResponseDto,
  BookingSettingsValuesDto,
  BookingSettingsRecordResponseDto,
  OrganizationRatingRecordResponseDto,
  OrganizationRatingVisibilityResponseDto,
)
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationSettingsController {
  constructor(
    private readonly submitRating: SubmitRatingHandler,
    private readonly listRatings: ListRatingsHandler,
    private readonly updateRatingVisibility: UpdateRatingVisibilityHandler,
    private readonly getOrgSettings: GetOrgSettingsHandler,
    private readonly upsertOrgSettings: UpsertOrgSettingsHandler,
    private readonly getBookingSettings: GetBookingSettingsHandler,
    private readonly upsertBookingSettings: UpsertBookingSettingsHandler,
  ) {}

  @Post('ratings')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Submit a rating for a booking' })
  @ApiCreatedResponse({ description: 'Rating submitted', type: OrganizationRatingRecordResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'Rating already submitted for this booking', type: ApiErrorDto })
  submitRatingEndpoint(@Body() body: SubmitRatingDto): Promise<OrganizationRatingRecordResponseDto> {
    return this.submitRating.execute(body);
  }

  @Get('ratings')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List ratings' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', schema: { type: 'integer', minimum: 1, default: 1, example: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', schema: { type: 'integer', minimum: 1, maximum: 200, default: 20, example: 20 } })
  @ApiOkResponse({ description: 'Paginated list of ratings', type: OrganizationRatingsResponseDto })
  listRatingsEndpoint(@Query() query: ListRatingsDto): Promise<OrganizationRatingsResponseDto> {
    return this.listRatings.execute(query);
  }

  @Patch('ratings/:id/visibility')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @ApiOperation({ summary: 'Update rating public visibility' })
  @ApiParam({ name: 'id', description: 'Rating UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Visibility updated', type: OrganizationRatingVisibilityResponseDto })
  @ApiResponse({ status: 404, description: 'Rating not found', type: ApiErrorDto })
  updateRatingVisibilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRatingVisibilityDto,
  ): Promise<OrganizationRatingVisibilityResponseDto> {
    return this.updateRatingVisibility.execute({ id, isPublic: body.isPublic });
  }

  @Get('settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiOkResponse({
    description: 'Current organization settings, or null when no settings row exists yet',
    schema: {
      allOf: [{ $ref: getSchemaPath(OrganizationSettingsResponseDto) }],
      nullable: true,
    },
  })
  getOrgSettingsEndpoint(): Promise<OrganizationSettingsResponseDto | null> {
    return this.getOrgSettings.execute();
  }

  @Patch('settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiOkResponse({ description: 'Organization settings updated', type: OrganizationSettingsResponseDto })
  @ApiResponse({ status: 400, description: 'Bank transfer details are incomplete or invalid', type: ApiErrorDto })
  @ApiResponse({ status: 403, description: 'Only a super-admin may change the VAT rate', type: ApiErrorDto })
  upsertOrgSettingsEndpoint(@Body() body: UpsertOrgSettingsDto): Promise<OrganizationSettingsResponseDto> {
    return this.upsertOrgSettings.execute(body);
  }

  @Get('booking-settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get booking settings' })
  @ApiOkResponse({
    description:
      'Current booking settings: the persisted row, or the built-in defaults (no id/timestamps) when no global row exists',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BookingSettingsValuesDto) },
        { $ref: getSchemaPath(BookingSettingsRecordResponseDto) },
      ],
    },
  })
  getBookingSettingsEndpoint(): Promise<BookingSettingsRecordResponseDto | BookingSettingsValuesDto> {
    return this.getBookingSettings.execute({ branchId: null });
  }

  @Patch('booking-settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update booking settings' })
  @ApiOkResponse({ description: 'Booking settings updated', type: BookingSettingsRecordResponseDto })
  @ApiResponse({ status: 400, description: 'The cancellation policy values are inconsistent or out of range', type: ApiErrorDto })
  upsertBookingSettingsEndpoint(@Body() body: UpsertBookingSettingsDto): Promise<BookingSettingsRecordResponseDto> {
    return this.upsertBookingSettings.execute({ branchId: null, ...body });
  }
}
