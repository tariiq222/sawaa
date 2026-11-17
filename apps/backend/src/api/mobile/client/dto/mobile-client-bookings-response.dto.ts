import { ApiProperty } from '@nestjs/swagger';
import type { Booking, Rating } from '@prisma/client';

/**
 * Swagger response shapes for the mobile client booking routes that had no
 * documented success schema: `GET /mobile/client/bookings/:id/join`,
 * `POST /mobile/client/bookings/:id/rate` and
 * `PATCH /mobile/client/bookings/:id/reschedule`.
 *
 * Documentation-only. The handlers keep their inferred return types; these
 * classes are never instantiated and no serializer is registered, so they
 * cannot change what is sent.
 */

/** `GET /mobile/client/bookings/:id/join` — the lazily created attendee link. */
export class MobileClientBookingJoinDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Zoom attendee join URL; null when the meeting has not been created yet (the listing is re-read after the create attempt).',
    example: 'https://zoom.us/j/123456789',
  })
  joinUrl!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Scheduled session start (ISO 8601 UTC)',
    example: '2026-05-20T07:00:00.000Z',
  })
  scheduledAt!: Date;
}

/** `POST /mobile/client/bookings/:id/rate` — the created rating row. */
export class MobileClientRatingResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Rating UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Rated booking UUID', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID derived from the booking', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID derived from the booking', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 5,
    description: 'Rating score from 1 to 5',
    example: 5,
  })
  score!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Optional client comment, or null', example: 'Great session' })
  comment!: string | null;

  @ApiProperty({
    description: 'Whether the rating is publicly visible. Always false on creation: client-supplied visibility is ignored.',
    example: false,
  })
  isPublic!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;
}

/**
 * The client-safe booking projection returned inside a mutation response.
 * Field list mirrors `CLIENT_MUTATION_FIELDS` in
 * `modules/bookings/client/client-booking-mutation.projection.ts`; the mapper
 * copies own keys from the domain row, so every field below is present for a
 * persisted booking. `price`/`priceSnapshot` are Prisma `Decimal` values and
 * serialize as decimal strings.
 */
export class MobileClientBookingMutationDto {
  @ApiProperty({ format: 'uuid', description: 'Booking UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Human-friendly sequential booking number', example: 1024 })
  bookingNumber!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Service UUID; null for group-program bookings', example: '00000000-0000-4000-a000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-000000000003' })
  employeeId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-00000000000c' })
  branchId!: string;

  @ApiProperty({ description: 'Booking status (Prisma enum)', example: 'CONFIRMED' })
  status!: string;

  @ApiProperty({ description: 'Appointment shape (Prisma enum)', example: 'INDIVIDUAL' })
  bookingType!: string;

  @ApiProperty({ description: 'Delivery channel (Prisma enum)', example: 'IN_PERSON' })
  deliveryType!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Start instant (UTC)', example: '2026-05-20T07:00:00.000Z' })
  scheduledAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'End instant (UTC)', example: '2026-05-20T08:00:00.000Z' })
  endsAt!: Date;

  @ApiProperty({ type: 'integer', description: 'Duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Duration captured at booking time, or null', example: 60 })
  durationMinutesSnapshot!: number | null;

  @ApiProperty({ type: String, description: 'Booked price in halalas, serialized as a decimal string', example: '20000' })
  price!: Booking['price'];

  @ApiProperty({ type: String, nullable: true, description: 'Price captured at booking time, decimal string, or null', example: '20000' })
  priceSnapshot!: Booking['priceSnapshot'];

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Client pays at the center', example: false })
  payAtClinic!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Service name captured at booking time', example: 'Family consultation' })
  serviceNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Employee name captured at booking time', example: 'Ahmed Al-Qahtani' })
  employeeNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Branch name captured at booking time', example: 'Riyadh' })
  branchNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category name captured at booking time', example: 'Family counseling' })
  categoryNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom attendee join URL, or null', example: null })
  zoomJoinUrl!: string | null;

  @ApiProperty({ enum: ['PENDING', 'CREATED', 'FAILED', 'CANCELLED'], nullable: true, description: 'Zoom meeting creation state, or null', example: null })
  zoomMeetingStatus!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T06:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: '2026-05-20T06:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Check-in instant, or null', example: null })
  checkedInAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Confirmation instant, or null', example: '2026-05-19T09:00:00.000Z' })
  confirmedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Completion instant, or null', example: null })
  completedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'No-show instant, or null', example: null })
  noShowAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Cancellation instant, or null', example: null })
  cancelledAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cancellation reason (Prisma enum), or null', example: null })
  cancelReason!: string | null;
}

/** `PATCH /mobile/client/bookings/:id/reschedule` — the updated client booking projection. */
export class MobileClientRescheduleResponseDto {
  @ApiProperty({ type: MobileClientBookingMutationDto, description: 'The rescheduled booking, client-safe projection' })
  booking!: MobileClientBookingMutationDto;
}

/** Compile-time guard: the rating DTO lists exactly the columns of the Prisma row. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const mobileClientRatingMatchesPrismaRow: Equal<keyof MobileClientRatingResponseDto, keyof Rating> = true;
