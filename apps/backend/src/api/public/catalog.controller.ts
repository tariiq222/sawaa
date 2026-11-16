import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiNotFoundResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicCatalogHandler } from '../../modules/org-experience/public-catalog/get-public-catalog.handler';
import { GetPractitionerBookingOptionsHandler } from '../../modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler';
import { PublicCatalogDto } from './catalog-response.dto';
import { PublicPractitionerBookingOptionsDto } from './practitioner-booking-options-response.dto';

@ApiTags('Public / Catalog')
@ApiPublicResponses()
@Controller('public/services')
export class PublicCatalogController {
  constructor(
    private readonly getPublicCatalog: GetPublicCatalogHandler,
    private readonly getPractitionerBookingOptions: GetPractitionerBookingOptionsHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get public service catalog (departments, categories, services)' })
  @ApiOkResponse({ type: PublicCatalogDto, description: 'Active departments, categories, and services' })
  @ApiQuery({ name: 'includeDirectClinics', required: false, type: Boolean, description: 'Include internal booking services for direct clinics' })
  getCatalog(@Query('includeDirectClinics') includeDirectClinics?: string): Promise<PublicCatalogDto> {
    return this.getPublicCatalog.execute({ includeDirectClinics: includeDirectClinics === 'true' });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':serviceId/practitioners/:employeeId/booking-options')
  @ApiOperation({ summary: 'Get booking options for a specific practitioner on a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    type: PublicPractitionerBookingOptionsDto,
    description: 'Booking options for this practitioner',
  })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  getPractitionerBookingOptionsEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<PublicPractitionerBookingOptionsDto> {
    return this.getPractitionerBookingOptions.execute({ serviceId, employeeId });
  }
}
