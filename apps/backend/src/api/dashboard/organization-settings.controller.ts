import { OrganizationRatingsResponseDto } from './dto/organization-ratings-response.dto';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
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

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
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
  @ApiCreatedResponse({ description: 'Rating submitted' })
  submitRatingEndpoint(@Body() body: SubmitRatingDto) {
    return this.submitRating.execute(body);
  }

  @Get('ratings')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List ratings' })
  @ApiOkResponse({ description: 'Paginated list of ratings', type: OrganizationRatingsResponseDto })
  listRatingsEndpoint(@Query() query: ListRatingsDto) {
    return this.listRatings.execute(query);
  }

  @Patch('ratings/:id/visibility')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @ApiOperation({ summary: 'Update rating public visibility' })
  @ApiParam({ name: 'id', description: 'Rating UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Visibility updated' })
  updateRatingVisibilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRatingVisibilityDto,
  ) {
    return this.updateRatingVisibility.execute({ id, isPublic: body.isPublic });
  }

  @Get('settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiOkResponse({ description: 'Current organization settings' })
  getOrgSettingsEndpoint() {
    return this.getOrgSettings.execute();
  }

  @Patch('settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiOkResponse({ description: 'Organization settings updated' })
  upsertOrgSettingsEndpoint(@Body() body: UpsertOrgSettingsDto) {
    return this.upsertOrgSettings.execute(body);
  }

  @Get('booking-settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get booking settings' })
  @ApiOkResponse({ description: 'Current booking settings' })
  getBookingSettingsEndpoint() {
    return this.getBookingSettings.execute({ branchId: null });
  }

  @Patch('booking-settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update booking settings' })
  @ApiOkResponse({ description: 'Booking settings updated' })
  upsertBookingSettingsEndpoint(@Body() body: UpsertBookingSettingsDto) {
    return this.upsertBookingSettings.execute({ branchId: null, ...body });
  }
}
