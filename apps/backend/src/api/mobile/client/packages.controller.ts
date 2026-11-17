import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ClientRoute } from '../../../common/auth/client-route.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { ListClientPackagePurchasesHandler } from '../../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ClientPackageBookDto } from '../../../modules/bookings/client/client-package-book.dto';
import { ClientPackageBookHandler } from '../../../modules/bookings/client/client-package-book.handler';
import { ClientPackagePurchaseStatusHandler } from '../../../modules/bookings/client/client-package-purchase-status.handler';
import { MobileBookingRecordDto } from '../dto/mobile-record-response.dto';
import {
  MobileClientPackagePurchaseDto,
} from './dto/mobile-client-packages-response.dto';

class MobileClientPackagePurchasesQuery {
  @ApiPropertyOptional({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus' })
  @IsOptional()
  @IsEnum(PackagePurchaseStatus)
  status?: PackagePurchaseStatus;
}

@ApiTags('Mobile Client / Packages')
@ApiStandardResponses()
@ClientRoute()
@Controller(['mobile/client/packages', 'public/me/packages'])
export class MobileClientPackagesController {
  constructor(
    private readonly listPurchases: ListClientPackagePurchasesHandler,
    private readonly purchaseStatus: ClientPackagePurchaseStatusHandler,
    private readonly bookPackageCredit: ClientPackageBookHandler,
  ) {}

  @Get('purchases')
  @ApiOperation({ summary: 'List the authenticated client package purchases and credit balance' })
  @ApiOkResponse({ type: [MobileClientPackagePurchaseDto], description: 'Decorated package purchases owned by the authenticated client' })
  listMyPurchases(
    @ClientSession() user: ClientSession,
    @Query() query: MobileClientPackagePurchasesQuery,
  ): Promise<MobileClientPackagePurchaseDto[]> {
    return this.listPurchases.execute({ clientId: user.id, status: query.status }).then((purchases) =>
      purchases.map(({ notes: _notes, ...safePurchase }) => safePurchase),
    );
  }

  @Get('purchases/:id')
  @ApiOperation({ summary: 'Read an authenticated client package purchase status' })
  @ApiParam({ name: 'id', description: 'Package purchase UUID', format: 'uuid' })
  @ApiOkResponse({ type: MobileClientPackagePurchaseDto, description: 'Decorated package purchase status' })
  getMyPurchase(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MobileClientPackagePurchaseDto> {
    return this.purchaseStatus.execute(id, user.id);
  }

  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book an appointment using an owned package credit' })
  @ApiCreatedResponse({ type: MobileBookingRecordDto, description: 'Package credit booking created' })
  bookCredit(
    @ClientSession() user: ClientSession,
    @Body() body: ClientPackageBookDto,
  ): Promise<MobileBookingRecordDto> {
    return this.bookPackageCredit.execute({
      ...body,
      clientId: user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }
}
