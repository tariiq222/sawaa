import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ZOHO_DATA_CENTERS, type ZohoDataCenter } from '../../../../infrastructure/zoho';

export class StartConnectDto {
  @ApiProperty({
    description: 'Zoho data center the tenant uses. KSA tenants must use "sa".',
    enum: ZOHO_DATA_CENTERS,
    example: 'sa',
  })
  @IsString()
  @IsEnum(ZOHO_DATA_CENTERS)
  dc!: ZohoDataCenter;
}

export class StartConnectResponseDto {
  @ApiProperty({ description: 'Authorization URL the dashboard should redirect to.' })
  authUrl!: string;
}

export class SelectOrganizationDto {
  @ApiProperty({ description: 'Zoho organization_id chosen by the tenant.' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  zohoOrganizationId!: string;
}

export class UpdateConfigDto {
  @ApiPropertyOptional({ description: 'When true, every newly created invoice is emailed automatically.' })
  @IsOptional()
  @IsBoolean()
  sendOnCreate?: boolean;

  @ApiPropertyOptional({ description: 'Default Zoho item id for ad-hoc booking line items.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemId?: string;

  @ApiPropertyOptional({ description: 'Optional Zoho branch id (multi-branch Zoho orgs only).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  branchId?: string;

  @ApiPropertyOptional({ description: 'Free-text payment terms appended to invoices.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentTerms?: string;
}

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status: draft|sent|paid|partially_paid|void|overdue' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Zoho contact id' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size, max 200', example: 25 })
  @IsOptional()
  perPage?: number;
}
