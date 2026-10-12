import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { CancellationReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';

/** Canonical body for `PATCH /client/bookings/:id/cancel`. */
export class ClientCancelBookingRequestDto extends PickType(ClientCancelBookingDto, [
  'acceptedRefundTerms',
  'quoteToken',
  'sourceActionId',
] as const) {
  @ApiPropertyOptional({
    description: 'Structured cancellation reason; defaults to CLIENT_REQUESTED',
    enum: CancellationReason,
    enumName: 'CancellationReason',
    default: CancellationReason.CLIENT_REQUESTED,
  })
  @IsOptional() @IsEnum(CancellationReason) reason?: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation (max 2000 chars)' })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
