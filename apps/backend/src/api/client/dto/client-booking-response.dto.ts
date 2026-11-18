import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, BookingType, CancellationReason, DeliveryType, type Booking } from '@prisma/client';
import { BookingRecordDto } from '../../dashboard/dto/booking-record-response.dto';

/**
 * Swagger response shapes for the authenticated CLIENT booking routes under
 * `src/api/client/bookings.controller.ts`:
 *
 *  - `GET  /client/bookings/:id/join`
 *  - `POST /client/bookings/:id/rate`
 *  - `PATCH /client/bookings/:id/reschedule`
 *  - `GET  /client/bookings/:id/invoice`
 *  - `POST /client/packages/book` (returns the raw created `Booking` row)
 *
 * Documentation only. No serializer is registered, so nothing here shapes the
 * response; the handlers keep their inferred return types and no file under
 * `src/modules/**` imports from this layer. `client-response.dto.spec.ts`
 * pins every class to the handler/projection output it documents.
 */

/** `GET /client/bookings/:id/join` — the lazily created attendee link. */
export class ClientBookingJoinResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Zoom attendee join URL; null when the meeting has not been created yet (the booking is re-read after the create attempt).',
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

/** `POST /client/bookings/:id/rate` — the created rating row. */
export class ClientBookingRatingResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Rating UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Rated booking UUID', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID derived from the booking', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID derived from the booking', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, description: 'Rating score from 1 to 5', example: 5 })
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
export class ClientBookingMutationDto {
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

  @ApiProperty({ enum: BookingStatus, enumName: 'BookingStatus', description: 'Booking status (Prisma enum)', example: 'CONFIRMED' })
  status!: BookingStatus;

  @ApiProperty({ enum: BookingType, enumName: 'BookingType', description: 'Appointment shape (Prisma enum)', example: 'INDIVIDUAL' })
  bookingType!: BookingType;

  @ApiProperty({ enum: DeliveryType, enumName: 'DeliveryType', description: 'Delivery channel (Prisma enum)', example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

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
  zoomMeetingStatus!: Booking['zoomMeetingStatus'];

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

  @ApiProperty({ enum: CancellationReason, enumName: 'CancellationReason', nullable: true, description: 'Cancellation reason (Prisma enum), or null', example: null })
  cancelReason!: Booking['cancelReason'];
}

/** `PATCH /client/bookings/:id/reschedule` — the updated client booking projection. */
export class ClientBookingRescheduleResponseDto {
  @ApiProperty({ type: ClientBookingMutationDto, description: 'The rescheduled booking, client-safe projection' })
  booking!: ClientBookingMutationDto;
}


/** Raw `Booking` row returned by `POST /client/packages/book` (documented per column). */
export class ClientBookingRecordDto extends BookingRecordDto {}

/**
 * `GET /client/bookings/:id/invoice` — the booking-scoped invoice projection
 * (`GetPublicInvoiceResult`) with the frozen receipt storage key replaced by
 * `hasReceipt`. Unlike `GET /client/invoices/:id` this read carries no invoice
 * `number` and no `payments` array (`GetBookingInvoiceHandler` returns the
 * public result only).
 */
export class ClientBookingInvoiceResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Seller name shown on the invoice', example: 'مركز سواء' })
  sellerName!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-00000000000c' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000003' })
  clientId!: string;

  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-000000000004' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID, or null', example: '00000000-0000-4000-a000-000000000002' })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package purchase UUID, or null', example: null })
  packagePurchaseId!: string | null;

  @ApiProperty({ type: 'number', description: 'Net amount before VAT and discount, in halalas', example: 20000 })
  subtotal!: number;

  @ApiProperty({ type: 'number', description: 'Discount amount in halalas', example: 0 })
  discountAmt!: number;

  @ApiProperty({ type: 'number', description: 'VAT rate as a fraction of 1 (0 when VAT is off)', example: 0 })
  vatRate!: number;

  @ApiProperty({ type: 'number', description: 'VAT amount in halalas', example: 0 })
  vatAmt!: number;

  @ApiProperty({ type: 'number', description: 'Invoice total in halalas', example: 20000 })
  total!: number;

  @ApiProperty({ type: 'number', description: 'Refunded amount in halalas', example: 0 })
  refundedAmount!: number;

  @ApiProperty({ type: 'number', description: 'Refunded VAT amount in halalas', example: 0 })
  refundedVatAmt!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Invoice status (Prisma enum)', example: 'PAID' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Issue instant, or null', example: '2026-05-20T09:00:00.000Z' })
  issuedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Due instant, or null', example: null })
  dueAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Paid instant, or null', example: '2026-05-20T09:05:00.000Z' })
  paidAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    description:
      'Whether a paid receipt PDF exists. Fetch it with `GET /client/invoices/:id/pdf`; the receipt storage key is never returned here.',
    example: true,
  })
  hasReceipt!: boolean;
}
