import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiNotFoundResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { PrismaService } from '../../infrastructure/database';
import { CacheService } from '../../infrastructure/cache';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../modules/media/media-image-url.helper';
import { GetPractitionerBookingOptionsHandler } from '../../modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler';
import { PublicCatalogDto } from './catalog-response.dto';

@ApiTags('Public / Catalog')
@ApiPublicResponses()
@Controller('public/services')
export class PublicCatalogController {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly getPractitionerBookingOptions: GetPractitionerBookingOptionsHandler,
    private readonly cache: CacheService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  /**
   * Replaces a stored media object key (or legacy full URL) with a freshly
   * minted short-lived presigned URL. Returns null when there is no image.
   */
  private signImageUrl(imageUrl: string | null): Promise<string | null> {
    return signMediaImageUrl(this.storage, this.mediaBucket, imageUrl);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get public service catalog (departments, categories, services)' })
  @ApiOkResponse({ description: 'Active departments, categories, and services', type: PublicCatalogDto })
  async getCatalog() {
    const catalog = await this.cache.getOrSet('ref:public-catalog', async () => {
      const [departments, categories, rawServices, orgSettings] = await Promise.all([
        this.prisma.department.findMany({
          // isVisible is the public hide-from-booking toggle; filter at the source
          // so hidden departments never reach any client (website/mobile). (R-32)
          where: { isActive: true, isVisible: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.serviceCategory.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.service.findMany({
          where: { isActive: true, isHidden: false, archivedAt: null },
          select: {
            id: true,
            categoryId: true,
            nameAr: true,
            nameEn: true,
            descriptionAr: true,
            descriptionEn: true,
            durationMins: true,
            price: true,
            currency: true,
            imageUrl: true,
            iconName: true,
            iconBgColor: true,
            hidePriceOnBooking: true,
            hideDurationOnBooking: true,
            durationOptions: {
              // Service-level catalog only: never expose practitioner-OWNED rows
              // (employeeServiceId != null) in the public service listing.
              where: { isActive: true, employeeServiceId: null },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                label: true,
                durationMins: true,
                price: true,
                sortOrder: true,
              },
            },
            bookingConfigs: {
              where: { isActive: true },
              select: {
                id: true,
                deliveryType: true,
                price: true,
                durationMins: true,
              },
            },
          },
          orderBy: { nameAr: 'asc' },
        }),
        // Same source the booking/invoice flow uses (create-booking.handler.ts) —
        // exposed so the website can display VAT-inclusive prices. Fractional
        // rate (0.15 = 15%), defaults to 0 when settings are missing.
        this.prisma.organizationSettings.findFirst({
          where: {},
          select: { vatRate: true },
        }),
      ]);

      const vatRate = Number(orgSettings?.vatRate?.toString() ?? '0');

      const services = rawServices.map(
        ({ hidePriceOnBooking, hideDurationOnBooking, ...service }) => ({
          ...service,
          showPrice: !hidePriceOnBooking,
          showDuration: !hideDurationOnBooking,
        }),
      );

      return { departments, categories, services, vatRate };
    }, 300);

    // Sign category and service images at read time. The cached payload above
    // holds bare object keys; mint fresh short-lived presigned URLs per response
    // (all signed concurrently, not one round-trip each) so links never outlive
    // their signature.
    const [categories, services] = await Promise.all([
      Promise.all(
        catalog.categories.map(async (category) => ({
          ...category,
          imageUrl: await this.signImageUrl(category.imageUrl),
        })),
      ),
      Promise.all(
        catalog.services.map(async (service) => ({
          ...service,
          imageUrl: await this.signImageUrl(service.imageUrl),
        })),
      ),
    ]);

    return { ...catalog, categories, services };
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
