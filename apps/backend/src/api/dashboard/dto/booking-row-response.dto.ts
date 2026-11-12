import { ApiProperty } from '@nestjs/swagger';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  DeliveryType,
  PackageCreditUsageStatus,
  ZoomMeetingStatus,
} from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of the dashboard booking READ projection produced by
 * `mapBookingRow` (modules/bookings/booking-row.mapper.ts). Used by
 * GET /dashboard/bookings, GET /dashboard/bookings/:id and the `booking`
 * member of POST /dashboard/bookings/late-entry.
 *
 * These classes only document the wire shape. They are never instantiated and
 * no serializer runs on responses, so they cannot change what is sent.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const BOOKING_STATUS_LOWER = Object.values(BookingStatus).map((s) => s.toLowerCase());
const BOOKING_TYPE_LOWER = Object.values(BookingType).map((t) =>
  t === BookingType.INDIVIDUAL ? 'in_person' : t.toLowerCase(),
);
const DELIVERY_TYPE_LOWER = Object.values(DeliveryType).map((d) => d.toLowerCase());

export class BookingRowClientDto {
  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Client first name (split from the full name when no first name is stored)', example: 'Sara' })
  firstName!: string;

  @ApiProperty({ description: 'Client last name', example: 'Al-Harbi' })
  lastName!: string;

  @ApiProperty({ description: 'Client email; empty string when none is stored', example: 'sara@example.com' })
  email!: string;

  @ApiProperty({ description: 'Client phone number', type: String, nullable: true, example: '+966500000000' })
  phone!: string | null;
}

export class BookingRowEmployeeUserDto {
  @ApiProperty({ description: 'Employee first name (split from the Arabic/display name)', example: 'Ahmed' })
  firstName!: string;

  @ApiProperty({ description: 'Employee last name', example: 'Al-Qahtani' })
  lastName!: string;
}

export class BookingRowEmployeeDto {
  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000003' })
  id!: string;

  @ApiProperty({ description: 'Linked user UUID; empty string when the employee has no user', example: '00000000-0000-0000-0000-000000000004' })
  userId!: string;

  @ApiProperty({ type: BookingRowEmployeeUserDto, description: 'Employee name parts' })
  user!: BookingRowEmployeeUserDto;

  @ApiProperty({ description: 'Specialty (English); empty string when unset', example: 'Family counseling' })
  specialty!: string;

  @ApiProperty({ description: 'Specialty (Arabic); empty string when unset', example: 'الإرشاد الأسري' })
  specialtyAr!: string;
}

export class BookingRowServiceDto {
  @ApiProperty({ description: 'Service UUID', example: '00000000-0000-0000-0000-000000000005' })
  id!: string;

  @ApiProperty({ description: 'Service name (Arabic)', example: 'استشارة أسرية' })
  nameAr!: string;

  @ApiProperty({ description: 'Service name (English); empty string when unset', example: 'Family consultation' })
  nameEn!: string;

  @ApiProperty({ description: 'Current catalog price of the service, as stored (not a booking snapshot)', example: 20000 })
  price!: number;

  @ApiProperty({ description: 'Catalog duration in minutes', example: 60 })
  duration!: number;
}

export class BookingRowPaymentDto {
  @ApiProperty({ description: 'Payment UUID', example: '00000000-0000-0000-0000-000000000006' })
  id!: string;

  @ApiProperty({ description: 'Payment amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ description: 'Payment method mapped for the dashboard', enum: ['moyasar', 'bank_transfer', 'cash', 'mada', 'tabby'], example: 'cash' })
  method!: 'moyasar' | 'bank_transfer' | 'cash' | 'mada' | 'tabby';

  @ApiProperty({ description: 'Payment status mapped for the dashboard', enum: ['pending', 'awaiting', 'paid', 'failed', 'refunded', 'rejected'], example: 'paid' })
  status!: 'pending' | 'awaiting' | 'paid' | 'failed' | 'refunded' | 'rejected';

  @ApiProperty({ description: 'Same value as amount, in halalas', example: 20000 })
  totalAmount!: number;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the money was actually received (manual receipts)', example: '2026-06-01T09:00:00.000Z' })
  effectiveReceivedAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the payment row was created', example: '2026-06-01T09:00:00.000Z' })
  createdAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the payment was processed', example: '2026-06-01T09:00:00.000Z' })
  processedAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'effectiveReceivedAt, falling back to createdAt', example: '2026-06-01T09:00:00.000Z' })
  collectionDate!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'User who recorded a manual receipt', example: '00000000-0000-0000-0000-000000000007' })
  receiptRecordedBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Evidence reference of a manual receipt', example: 'RCPT-1001' })
  receiptEvidenceRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Reason given when a receipt was entered after the fact', example: 'Received at the front desk' })
  receiptEntryReason!: string | null;
}

export class BookingRowInvoiceDto {
  @ApiProperty({ description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000008' })
  id!: string;

  @ApiProperty({ description: 'Net amount before VAT and discount, in halalas', example: 20000 })
  subtotal!: number;

  @ApiProperty({ description: 'VAT rate as a fraction of 1 (0 when VAT is off)', example: 0 })
  vatRate!: number;

  @ApiProperty({ description: 'Total after discount, in halalas', example: 20000 })
  total!: number;

  @ApiProperty({ description: 'Total minus completed payments, in halalas', example: 0 })
  outstanding!: number;

  @ApiProperty({ description: 'Invoice status (Prisma InvoiceStatus)', example: 'PAID' })
  status!: string;
}

export class BookingRowPackageFundingDto {
  @ApiProperty({ description: 'Package credit UUID that funds this booking', example: '00000000-0000-0000-0000-000000000009' })
  creditId!: string;

  @ApiProperty({ description: 'Package purchase UUID', example: '00000000-0000-0000-0000-00000000000a' })
  purchaseId!: string;

  @ApiProperty({ description: 'Session package UUID', example: '00000000-0000-0000-0000-00000000000b' })
  packageId!: string;

  @ApiProperty({ description: 'Package name (Arabic)', example: 'باقة 5 جلسات' })
  packageNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Package name (English)', example: '5-session package' })
  packageNameEn!: string | null;

  @ApiProperty({ description: 'State of the credit usage for this booking', enum: Object.values(PackageCreditUsageStatus), example: 'RESERVED' })
  usageStatus!: 'RESERVED' | 'CONSUMED' | 'RETURNED';

  @ApiProperty({ type: Number, nullable: true, description: 'Net halalas the client paid for this one session (reporting only); null for credits issued before net value was tracked', example: 18000 })
  sessionValue!: number | null;
}

export class BookingRowHistoricalPaymentDto {
  @ApiProperty({ description: 'Imported (Booknetic) payment status', enum: ['paid', 'not_paid', 'pending', 'canceled', 'unknown'], example: 'paid' })
  status!: 'paid' | 'not_paid' | 'pending' | 'canceled' | 'unknown';

  @ApiProperty({ description: 'Imported paid amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Imported payment method label', example: 'Cash' })
  method!: string | null;

  @ApiProperty({ description: 'True when the imported payment was paid but the booking is not CONFIRMED', example: false })
  requiresReview!: boolean;
}

export class BookingRowDto {
  @ApiProperty({ description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Human-friendly sequential booking number', example: 1024 })
  bookingNumber!: number;

  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000001' })
  clientId!: string;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000003' })
  employeeId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service UUID; null for group-program bookings', example: '00000000-0000-0000-0000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ type: BookingRowPackageFundingDto, nullable: true, description: 'Package-credit funding details; null when not funded by a package' })
  packageFunding!: BookingRowPackageFundingDto | null;

  @ApiProperty({ description: 'Always an empty string (legacy field kept for compatibility)', example: '' })
  employeeServiceId!: string;

  @ApiProperty({ description: 'Booking type, lower-case; INDIVIDUAL is reported as in_person', enum: BOOKING_TYPE_LOWER, example: 'in_person' })
  type!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Delivery channel, lower-case', enum: DELIVERY_TYPE_LOWER, example: 'in_person' })
  deliveryType!: string | null;

  @ApiProperty({ description: 'Where the booking was created', enum: BookingSource, enumName: 'BookingSource', example: 'RECEPTION' })
  source!: BookingSource;

  @ApiProperty({ description: 'Client selected payment at the center; independent of financial payment status', example: true })
  payAtClinic!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Category name captured at booking time', example: 'Family counseling' })
  categoryNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Branch name captured at booking time', example: 'Riyadh' })
  branchNameSnapshot!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Duration in minutes captured at booking time', example: 60 })
  durationMinutesSnapshot!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Price in halalas captured at booking time', example: 20000 })
  priceSnapshot!: number | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Start instant (UTC ISO); null only for a malformed legacy row', example: '2026-06-01T09:00:00.000Z' })
  scheduledAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'End instant (UTC ISO); null only for a malformed legacy row', example: '2026-06-01T10:00:00.000Z' })
  endsAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Business-timezone calendar date (YYYY-MM-DD)', example: '2026-06-01' })
  date!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Business-timezone start time (HH:mm)', example: '12:00' })
  startTime!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Business-timezone end time (HH:mm)', example: '13:00' })
  endTime!: string | null;

  @ApiProperty({ description: 'Booking status, lower-case', enum: BOOKING_STATUS_LOWER, example: 'confirmed' })
  status!: string;

  @ApiProperty({ description: 'True for rows imported from the legacy system (read-only)', example: false })
  isHistoricalImport!: boolean;

  @ApiProperty({ description: 'True when the session was recorded after the fact (late entry)', example: false })
  isLateEntry!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'When the late entry was recorded', example: '2026-06-02T09:00:00.000Z' })
  lateEntryRecordedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'User id who recorded the late entry', example: '00000000-0000-0000-0000-000000000007' })
  lateEntryRecordedBy!: string | null;

  @ApiProperty({ type: BookingRowHistoricalPaymentDto, nullable: true, description: 'Imported payment projection; only for historical imports' })
  historicalPayment!: BookingRowHistoricalPaymentDto | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Check-in instant', example: '2026-06-01T08:55:00.000Z' })
  checkedInAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text booking notes', example: 'Prefers morning sessions' })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Zoom join URL for the client', example: 'https://zoom.us/j/123' })
  zoomJoinUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null on dashboard reads: host URLs are stripped (P0-6)', example: null })
  zoomHostUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null on dashboard reads: start URLs are stripped (P0-6)', example: null })
  zoomStartUrl!: string | null;

  @ApiProperty({ enum: Object.values(ZoomMeetingStatus), nullable: true, description: 'Zoom meeting creation state', example: 'CREATED' })
  zoomMeetingStatus!: ZoomMeetingStatus | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last Zoom creation error', example: null })
  zoomMeetingError!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cancellation reason (for late entries the free-text notes win over the enum)', example: 'CLIENT_REQUESTED' })
  cancellationReason!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null today (reserved)', example: null })
  cancelledBy!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null today (reserved)', example: null })
  suggestedRefundType!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null today (reserved)', example: null })
  adminNotes!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Cancellation instant', example: null })
  cancelledAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Confirmation instant', example: '2026-05-30T09:00:00.000Z' })
  confirmedAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Completion instant', example: null })
  completedAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'No-show instant', example: null })
  noShowAt!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-05-30T08:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-05-30T08:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: BookingRowClientDto, nullable: true, description: 'Client summary; null when the client row is missing' })
  client!: BookingRowClientDto | null;

  @ApiProperty({ type: BookingRowEmployeeDto, nullable: true, description: 'Employee summary; null when the employee row is missing' })
  employee!: BookingRowEmployeeDto | null;

  @ApiProperty({ type: BookingRowServiceDto, nullable: true, description: 'Service summary; null for group-program bookings or a missing service' })
  service!: BookingRowServiceDto | null;

  @ApiProperty({ type: Object, nullable: true, description: 'Always null today (reserved)', example: null })
  employeeService!: null;

  @ApiProperty({ type: Object, nullable: true, description: 'Always null today (reserved)', example: null })
  rescheduledFrom!: null;

  @ApiProperty({ type: BookingRowPaymentDto, nullable: true, description: 'Latest payment on the booking invoice; null when none' })
  payment!: BookingRowPaymentDto | null;

  @ApiProperty({ type: BookingRowInvoiceDto, nullable: true, description: 'Invoice summary; null when no invoice exists' })
  invoice!: BookingRowInvoiceDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Always null today (reserved)', example: null })
  intakeFormId!: string | null;

  @ApiProperty({ description: 'Always false today (reserved)', example: false })
  intakeFormAlreadySubmitted!: boolean;
}

export class PaginatedBookingRowsDto {
  @ApiProperty({ type: [BookingRowDto], description: 'Bookings on the requested page' })
  items!: BookingRowDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}
