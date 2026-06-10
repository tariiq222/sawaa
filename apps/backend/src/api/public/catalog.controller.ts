import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { PrismaService } from '../../infrastructure/database';

@ApiTags('Public / Catalog')
@ApiPublicResponses()
@Controller('public/services')
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get public service catalog (departments, categories, services)' })
  @ApiOkResponse({ description: 'Active departments, categories, and services' })
  async getCatalog() {
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
          minParticipants: true,
          durationOptions: {
            where: { isActive: true },
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
  }
}
