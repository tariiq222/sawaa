import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';

/**
 * Filter for the client purchases list.
 * status = ACTIVE returns only purchases with remaining credit; COMPLETED
 * returns fully-consumed purchases; REFUNDED returns refunded purchases.
 * When status is omitted all rows are returned.
 */
export class ListClientPackagePurchasesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by purchase status',
    enum: PackagePurchaseStatus,
    enumName: 'PackagePurchaseStatus',
  })
  @IsOptional() @IsEnum(PackagePurchaseStatus) status?: PackagePurchaseStatus;
}