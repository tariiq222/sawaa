import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListInvoicesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() bookingId?: string;

  @ApiPropertyOptional({ description: 'Filter by invoice status', enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Include invoices created on or after this ISO date', example: '2026-05-01T00:00:00.000Z' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'Include invoices created on or before this ISO date', example: '2026-05-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() toDate?: string;
}
