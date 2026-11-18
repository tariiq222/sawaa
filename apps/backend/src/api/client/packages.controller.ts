import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ApiStandardResponses } from '../../common/swagger';
import { ListClientPackagePurchasesHandler } from '../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ClientPackageBookDto } from '../../modules/bookings/client/client-package-book.dto';
import { ClientPackageBookHandler } from '../../modules/bookings/client/client-package-book.handler';
import { ClientPackagePurchaseStatusHandler } from '../../modules/bookings/client/client-package-purchase-status.handler';
import { ClientBookingRecordDto } from './dto/client-booking-response.dto';
import { ClientPackagePurchaseDto } from './dto/client-package-response.dto';

class ClientPackagePurchasesQuery {
  @ApiPropertyOptional({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus' })
  @IsOptional()
  @IsEnum(PackagePurchaseStatus)
  status?: PackagePurchaseStatus;
}

@ApiTags('Client / Packages')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/packages')
export class ClientPackagesController {
  constructor(
    private readonly listPurchases: ListClientPackagePurchasesHandler,
    private readonly purchaseStatus: ClientPackagePurchaseStatusHandler,
    private readonly bookPackageCredit: ClientPackageBookHandler,
  ) {}

  @Get('purchases')
  @ApiOperation({ summary: 'List the authenticated client package purchases and credit balance' })
  @ApiOkResponse({ type: [ClientPackagePurchaseDto], description: 'Decorated package purchases owned by the authenticated client' })
  async listMyPurchases(
    @ClientSession() session: ClientSession,
    @Query() query: ClientPackagePurchasesQuery,
  ): Promise<ClientPackagePurchaseDto[]> {
    const purchases = await this.listPurchases.execute({ clientId: session.id, status: query.status });
    return purchases.map(({ notes: _notes, ...safePurchase }) => safePurchase);
  }

  @Get('purchases/:id')
  @ApiOperation({ summary: 'Read an authenticated client package purchase status' })
  @ApiParam({ name: 'id', description: 'Package purchase UUID', format: 'uuid' })
  @ApiOkResponse({ type: ClientPackagePurchaseDto, description: 'Decorated package purchase status' })
  getMyPurchase(
    @ClientSession() session: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientPackagePurchaseDto> {
    return this.purchaseStatus.execute(id, session.id);
  }

  @ClientThrottle('money')
  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book an appointment using an owned package credit' })
  @ApiCreatedResponse({ type: ClientBookingRecordDto, description: 'Package credit booking created' })
  bookCredit(
    @ClientSession() session: ClientSession,
    @Body() body: ClientPackageBookDto,
  ): Promise<ClientBookingRecordDto> {
    return this.bookPackageCredit.execute({
      ...body,
      clientId: session.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }
}
