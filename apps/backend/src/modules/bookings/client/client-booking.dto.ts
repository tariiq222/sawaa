import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersistedCancellationRefundDto } from './client-cancellation-preview.dto';

/**
 * Canonical client-facing booking read model, shared by the website
 * (`GET /public/me/bookings[/:id]`) and the mobile app
 * (`GET /mobile/client/bookings[/:id]`).
 *
 * It is the UNION of the flat website item and the client-safe subset of
 * `mapBookingRow`. Where the two origins named the same thing differently both
 * names are kept for the alias period; the mapper-origin one is marked
 * deprecated. Staff-only fields (internal notes, host/start Zoom URLs, late
 * entry authorship, import flags, source, receipt metadata, other clients)
 * are never part of this shape.
 */
export class ClientBookingEmployeeDto {
  @ApiProperty({ description: 'Employee id', format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ description: 'Arabic name', nullable: true, type: String }) nameAr!: string | null;
  @ApiPropertyOptional({ description: 'English name', nullable: true, type: String }) nameEn!: string | null;
  @ApiPropertyOptional({ description: 'Avatar URL', nullable: true, type: String }) avatarUrl!: string | null;
  @ApiProperty({ description: 'Display name parts (mapper origin, kept for the alias period)', example: { firstName: 'Sara', lastName: '' } })
  user!: { firstName: string; lastName: string };
  @ApiProperty({ description: 'Specialty (English)', example: '' }) specialty!: string;
  @ApiProperty({ description: 'Specialty (Arabic)', example: '' }) specialtyAr!: string;
}

export class ClientBookingBranchDto {
  @ApiProperty({ description: 'Branch id', format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ description: 'Arabic name', nullable: true, type: String }) nameAr!: string | null;
  @ApiPropertyOptional({ description: 'English name', nullable: true, type: String }) nameEn!: string | null;
}

export class ClientBookingServiceDto {
  @ApiProperty({ description: 'Service id', format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Arabic name' }) nameAr!: string;
  @ApiProperty({ description: 'English name (empty string when absent)' }) nameEn!: string;
  @ApiProperty({ description: 'Service list price (not the booked price); unit per `currency`' }) price!: number;
  @ApiProperty({ description: 'Service duration in minutes' }) duration!: number;
}

export class ClientBookingPaymentDto {
  @ApiProperty({ description: 'Payment id', format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Amount in halalas' }) amount!: number;
  @ApiProperty({ description: 'Amount in halalas (alias of amount)' }) totalAmount!: number;
  @ApiProperty({ description: 'UI payment method', enum: ['moyasar', 'bank_transfer', 'cash', 'mada', 'tabby'] }) method!: string;
  @ApiProperty({ description: 'UI payment status', enum: ['pending', 'awaiting', 'paid', 'failed', 'refunded', 'rejected'] }) status!: string;
}

export class ClientBookingInvoiceDto {
  @ApiProperty({ description: 'Invoice id', format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Subtotal in halalas' }) subtotal!: number;
  @ApiProperty({ description: 'Fractional VAT rate (0 when the center is not VAT-registered)' }) vatRate!: number;
  @ApiProperty({ description: 'Total after discount in halalas' }) total!: number;
  @ApiProperty({ description: 'Total minus completed payments in halalas' }) outstanding!: number;
  @ApiProperty({ description: 'Invoice status (Prisma enum)' }) status!: string;
}

export class ClientBookingDto {
  // --- identity / lifecycle (both origins) ---------------------------------
  @ApiProperty({ description: 'Booking id', format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ description: 'Human-readable booking number (mapper origin)', nullable: true, type: Number }) bookingNumber!: number | null;
  @ApiProperty({ description: 'Booking status. Upper-case Prisma enum on the web route, lower-case on the mobile route (legacy wire format).', example: 'CONFIRMED' }) status!: string;
  @ApiProperty({ description: 'Created at (ISO 8601)' }) createdAt!: string;
  @ApiProperty({ description: 'Updated at (ISO 8601, mapper origin)' }) updatedAt!: string;
  @ApiPropertyOptional({ description: 'Checked-in at (ISO 8601)', nullable: true, type: String }) checkedInAt!: string | null;
  @ApiPropertyOptional({ description: 'Confirmed at (ISO 8601)', nullable: true, type: String }) confirmedAt!: string | null;
  @ApiPropertyOptional({ description: 'Completed at (ISO 8601)', nullable: true, type: String }) completedAt!: string | null;
  @ApiPropertyOptional({ description: 'No-show at (ISO 8601)', nullable: true, type: String }) noShowAt!: string | null;
  @ApiPropertyOptional({ description: 'Cancelled at (ISO 8601)', nullable: true, type: String }) cancelledAt!: string | null;
  @ApiPropertyOptional({ description: 'Cancellation reason code; null for late-entry rows', nullable: true, type: String }) cancellationReason!: string | null;

  // --- schedule -------------------------------------------------------------
  @ApiProperty({ description: 'Start (ISO 8601)' }) scheduledAt!: string;
  @ApiPropertyOptional({ description: 'End (ISO 8601)', nullable: true, type: String }) endsAt!: string | null;
  @ApiPropertyOptional({ description: 'Start date, Asia/Riyadh wall clock (YYYY-MM-DD)', nullable: true, type: String }) date!: string | null;
  @ApiPropertyOptional({ description: 'Start time, Asia/Riyadh wall clock (HH:mm)', nullable: true, type: String }) startTime!: string | null;
  @ApiPropertyOptional({ description: 'End time, Asia/Riyadh wall clock (HH:mm)', nullable: true, type: String }) endTime!: string | null;
  @ApiProperty({ description: 'Duration in minutes' }) durationMins!: number;
  @ApiPropertyOptional({ description: '@deprecated Alias of durationMins (mapper origin).', nullable: true, type: Number }) durationMinutesSnapshot!: number | null;

  // --- money ----------------------------------------------------------------
  @ApiProperty({ description: 'Booked price serialised as a decimal string; unit per `currency`', example: '150' }) price!: string;
  @ApiPropertyOptional({ description: '@deprecated Alias of price as a number (mapper origin).', nullable: true, type: Number }) priceSnapshot!: number | null;
  @ApiProperty({ description: 'Currency code', example: 'SAR' }) currency!: string;
  @ApiProperty({ description: 'Client pays at the center' }) payAtClinic!: boolean;
  @ApiPropertyOptional({ description: 'Raw latest payment status (Prisma enum); null when no payment', nullable: true, type: String }) paymentStatus!: string | null;
  @ApiPropertyOptional({ description: 'Invoice id', nullable: true, type: String }) invoiceId!: string | null;
  @ApiPropertyOptional({ description: 'Raw invoice status (Prisma enum)', nullable: true, type: String }) invoiceStatus!: string | null;
  @ApiPropertyOptional({ type: () => ClientBookingPaymentDto, nullable: true, description: 'Latest payment summary (mapper origin)' }) payment!: ClientBookingPaymentDto | null;
  @ApiPropertyOptional({ type: () => ClientBookingInvoiceDto, nullable: true, description: 'Invoice summary (mapper origin)' }) invoice!: ClientBookingInvoiceDto | null;

  // --- type / delivery ------------------------------------------------------
  @ApiProperty({ description: 'Session delivery channel. IN_PERSON/ONLINE on the web route, lower-case on the mobile route.', example: 'ONLINE' }) deliveryType!: string;
  @ApiProperty({ description: 'Booking type, lower-case (individual, walk_in, group)' }) bookingType!: string;
  @ApiProperty({ description: '@deprecated Legacy UI alias of bookingType (mapper origin; individual maps to in_person).' }) type!: string;
  @ApiPropertyOptional({ description: 'Category name snapshot', nullable: true, type: String }) categoryNameSnapshot!: string | null;
  @ApiPropertyOptional({ description: '@deprecated Branch name snapshot; prefer branchName/branchNameAr.', nullable: true, type: String }) branchNameSnapshot!: string | null;

  // --- service / employee / branch -----------------------------------------
  @ApiPropertyOptional({ description: 'Service id', nullable: true, type: String }) serviceId!: string | null;
  @ApiProperty({ description: 'Service name (English, falls back to Arabic then snapshot)' }) serviceName!: string;
  @ApiPropertyOptional({ description: 'Service name (Arabic)', nullable: true, type: String }) serviceNameAr!: string | null;
  @ApiPropertyOptional({ description: 'Client-visible service summary for this booking', type: () => ClientBookingServiceDto, nullable: true }) service!: ClientBookingServiceDto | null;
  @ApiProperty({ description: 'Employee id', format: 'uuid' }) employeeId!: string;
  @ApiProperty({ description: 'Employee name (English)' }) employeeName!: string;
  @ApiPropertyOptional({ description: 'Employee name (Arabic)', nullable: true, type: String }) employeeNameAr!: string | null;
  @ApiPropertyOptional({ description: 'Client-visible practitioner profile without staff account fields', type: () => ClientBookingEmployeeDto, nullable: true }) employee!: ClientBookingEmployeeDto | null;
  @ApiProperty({ description: 'Branch id', format: 'uuid' }) branchId!: string;
  @ApiProperty({ description: 'Branch name (English)' }) branchName!: string;
  @ApiPropertyOptional({ description: 'Branch name (Arabic)', nullable: true, type: String }) branchNameAr!: string | null;
  @ApiPropertyOptional({ description: 'Client-visible branch summary for this booking', type: () => ClientBookingBranchDto, nullable: true }) branch!: ClientBookingBranchDto | null;

  // --- zoom (client-safe only) ---------------------------------------------
  @ApiPropertyOptional({ description: 'Zoom join URL (attendee link)', nullable: true, type: String }) zoomJoinUrl!: string | null;
  @ApiPropertyOptional({ description: 'Always null for clients (host privilege URL). Key kept for shipped mobile builds.', nullable: true, type: String }) zoomStartUrl!: string | null;
  @ApiPropertyOptional({ description: 'Always null for clients (host privilege URL). Key kept for the alias period.', nullable: true, type: String }) zoomHostUrl!: string | null;
  @ApiPropertyOptional({ description: 'Zoom meeting status', enum: ['PENDING', 'CREATED', 'FAILED', 'CANCELLED'], nullable: true }) zoomMeetingStatus!: string | null;

  // --- client-only state ----------------------------------------------------
  @ApiProperty({ description: 'Whether this client already rated the booking' }) hasRated!: boolean;
  @ApiPropertyOptional({ type: () => PersistedCancellationRefundDto, description: 'Persisted refund outcome; present on detail only, when status is CANCELLED' }) cancellationRefund?: PersistedCancellationRefundDto;
}
