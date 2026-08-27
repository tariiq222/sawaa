import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for `PATCH /dashboard/bookings/:id/restore-no-show`.
 *
 * The reason is required, written to `BookingStatusLog.reason` prefixed with
 * `'Restored from no-show:'` so the audit trail always shows WHY a terminal
 * status was reverted. It is NOT a free-form cancellation reason and does NOT
 * trigger any refund — the no-show forfeit stands.
 */
export class RestoreNoShowBookingDto {
  @ApiProperty({
    description:
      'Audited reason explaining why the booking is being restored from no-show. ' +
      'Stored verbatim in BookingStatusLog.reason with a "Restored from no-show:" prefix.',
    minLength: 3,
    maxLength: 500,
    example: 'Client arrived 5 min late; auto-no-show fired in error',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
