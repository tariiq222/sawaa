import { CancellationReason } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelBookingDto {
  @ApiProperty({ description: 'Reason for cancellation', enum: CancellationReason, enumName: 'CancellationReason', example: CancellationReason.CLIENT_REQUESTED })
  @IsEnum(CancellationReason) reason!: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation', example: 'Client called to cancel' })
  @IsOptional() @IsString() cancelNotes?: string;

  @ApiPropertyOptional({ description: 'Party initiating the cancellation', example: 'admin', enum: ['client', 'admin', 'employee', 'system'] })
  @IsOptional() @IsIn(['client', 'admin', 'employee', 'system']) source?:
    | 'client'
    | 'admin'
    | 'employee'
    | 'system';
}
