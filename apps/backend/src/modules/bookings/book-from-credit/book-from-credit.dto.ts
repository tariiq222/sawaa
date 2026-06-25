import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { DeliveryType } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Book an appointment by consuming session-package credit.
 *
 * The caller either targets an explicit `creditId`, OR supplies the full
 * (serviceId, employeeId, durationOptionId) triple so the handler can
 * FIFO-select the matching credit. The duration is FIXED by the credit — the
 * caller cannot pass a duration.
 */
export class BookFromCreditDto {
  @ApiProperty({ description: 'Client booking the appointment', example: '00000000-0000-4000-a000-000000000001', format: 'uuid' })
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({
    description: 'Explicit PackageCredit bucket to consume. When omitted, the handler FIFO-selects the oldest matching credit from the (serviceId, employeeId, durationOptionId) triple.',
    example: '00000000-0000-4000-a000-000000000006',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  creditId?: string;

  @ApiPropertyOptional({ description: 'Service to match a credit on (required when creditId is omitted)', example: '00000000-0000-4000-a000-000000000004', format: 'uuid' })
  @ValidateIf((o: BookFromCreditDto) => !o.creditId)
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Employee to match a credit on (required when creditId is omitted)', example: '00000000-0000-4000-a000-000000000003', format: 'uuid' })
  @ValidateIf((o: BookFromCreditDto) => !o.creditId)
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Duration option to match a credit on (required when creditId is omitted)', example: '00000000-0000-4000-a000-000000000005', format: 'uuid' })
  @ValidateIf((o: BookFromCreditDto) => !o.creditId)
  @IsUUID()
  durationOptionId?: string;

  @ApiProperty({ description: 'Branch where the appointment takes place', example: '00000000-0000-4000-a000-000000000002', format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Appointment start time (ISO 8601, must be in the future)', example: '2026-12-31T09:00:00Z', format: 'date-time' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Delivery channel; defaults to the credit duration option delivery type', enum: DeliveryType, example: DeliveryType.IN_PERSON })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Free-form note attached to the booking', example: 'Returning client' })
  @IsOptional()
  @IsString()
  notes?: string;
}
