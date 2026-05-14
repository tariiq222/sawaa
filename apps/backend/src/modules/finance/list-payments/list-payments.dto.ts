import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListPaymentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() invoiceId?: string;

  @ApiPropertyOptional({ description: 'Filter by client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by payment method', enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Filter by payment status', enum: PaymentStatus, enumName: 'PaymentStatus' })
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Include payments on or after this ISO date', example: '2026-05-01T00:00:00.000Z' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'Include payments on or before this ISO date', example: '2026-05-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() toDate?: string;
}
