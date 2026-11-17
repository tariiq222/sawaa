import { ApiProperty } from '@nestjs/swagger';
import { ZoomMeetingStatus } from '@prisma/client';
import {
  BookingRowDto,
  PaginatedBookingRowsDto,
} from '../../../dashboard/dto/booking-row-response.dto';

/**
 * Swagger response shapes for the mobile employee booking routes that had no
 * documented success schema.
 *
 * `GET /mobile/employee/bookings` and `GET /mobile/employee/bookings/:id` return
 * the dashboard read projection built by `mapBookingRow`
 * (`modules/bookings/booking-row.mapper.ts`) — the same shape the dashboard
 * `BookingRowDto` documents. These subclasses pin that shape under a mobile
 * schema name without re-declaring columns.
 *
 * Documentation-only: no serializer is registered, so nothing here shapes the
 * response.
 */

/** One booking row of `GET /mobile/employee/bookings` (mapper projection). */
export class MobileEmployeeBookingRowDto extends BookingRowDto {}

/** Paginated employee booking list. */
export class MobileEmployeeBookingListResponseDto extends PaginatedBookingRowsDto {}

/** `GET /mobile/employee/bookings/:id/start-meeting` host details. */
export class MobileEmployeeMeetingStartDto {
  @ApiProperty({ format: 'uuid', description: 'Booking UUID', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Scheduled session start (ISO 8601 UTC)', example: '2026-05-20T07:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty({ type: 'integer', description: 'Session duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({
    enum: ZoomMeetingStatus,
    enumName: 'ZoomMeetingStatus',
    nullable: true,
    description: 'Zoom meeting status, or null when no meeting exists yet',
    example: 'CREATED',
  })
  meetingStatus!: ZoomMeetingStatus | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Host start URL; null until the meeting is created (only the assigned employee can receive it)',
    example: null,
  })
  startUrl!: string | null;
}
