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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { ListClientPackagePurchasesHandler } from '../../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ClientPackageBookDto } from '../../../modules/bookings/client/client-package-book.dto';
import { ClientPackageBookHandler } from '../../../modules/bookings/client/client-package-book.handler';
import { ClientPackagePurchaseStatusHandler } from '../../../modules/bookings/client/client-package-purchase-status.handler';

class MobileClientPackagePurchasesQuery {
  @ApiPropertyOptional({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus' })
  @IsOptional()
  @IsEnum(PackagePurchaseStatus)
  status?: PackagePurchaseStatus;
}

@ApiTags('Mobile Client / Packages')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller(['mobile/client/packages', 'public/me/packages'])
export class MobileClientPackagesController {
  constructor(
    private readonly listPurchases: ListClientPackagePurchasesHandler,
    private readonly purchaseStatus: ClientPackagePurchaseStatusHandler,
    private readonly bookPackageCredit: ClientPackageBookHandler,
  ) {}

  @Get('purchases')
  @ApiOperation({ summary: 'List the authenticated client package purchases and credit balance' })
  @ApiOkResponse({ description: 'Decorated package purchases owned by the authenticated client' })
  listMyPurchases(
    @ClientSession() user: ClientSession,
    @Query() query: MobileClientPackagePurchasesQuery,
  ) {
    return this.listPurchases.execute({ clientId: user.id, status: query.status }).then((purchases) =>
      purchases.map(({ notes: _notes, ...safePurchase }) => safePurchase),
    );
  }

  @Get('purchases/:id')
  @ApiOperation({ summary: 'Read an authenticated client package purchase status' })
  @ApiParam({ name: 'id', description: 'Package purchase UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Decorated package purchase status' })
  getMyPurchase(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchaseStatus.execute(id, user.id);
  }

  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book an appointment using an owned package credit' })
  @ApiCreatedResponse({ description: 'Package credit booking created' })
  bookCredit(
    @ClientSession() user: ClientSession,
    @Body() body: ClientPackageBookDto,
  ) {
    return this.bookPackageCredit.execute({
      ...body,
      clientId: user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }
}
