import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiNotFoundResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicCatalogHandler } from '../../modules/org-experience/public-catalog/get-public-catalog.handler';
import { GetPractitionerBookingOptionsHandler } from '../../modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler';
import { PublicCatalogDto } from './catalog-response.dto';

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
  @ApiOkResponse({ description: 'Active departments, categories, and services', type: PublicCatalogDto })
  getCatalog() {
    return this.getPublicCatalog.execute();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':serviceId/practitioners/:employeeId/booking-options')
  @ApiOperation({ summary: 'Get booking options for a specific practitioner on a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Booking options for this practitioner',
    schema: {
      type: 'object',
      properties: {
        useCustomPricing: { type: 'boolean' },
        disabledDeliveryTypes: { type: 'array', items: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] } },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deliveryType: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] },
              durationOptionId: { type: 'string' },
              durationMins: { type: 'number' },
              price: { type: 'number' },
              currency: { type: 'string' },
              label: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  getPractitionerBookingOptionsEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.getPractitionerBookingOptions.execute({ serviceId, employeeId });
  }
}
