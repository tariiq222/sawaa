import { ApiProperty } from '@nestjs/swagger';
import { ClientCancelCutoffMode, Prisma, RefundType } from '@prisma/client';

/**
 * Response shapes of the dashboard organization-settings, booking-settings and
 * rating routes (`organization-settings.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Every property is traced to a Prisma model or to a handler return
 * value; `organization-settings-response.dto.spec.ts` asserts each one equals
 * its handler's inferred output.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

// ── Organization settings ───────────────────────────────────────────────────

/**
 * One stored bank-transfer account.
 *
 * `bankTransferAccounts` is a JSON column and the dashboard GET returns it
 * verbatim, so this shape is the one the PATCH write path validates and
 * persists (`getValidBankTransferAccounts`), not a projection applied on read.
 */
export class BankTransferAccountResponseDto {
  @ApiProperty({ description: 'Stable account id used by the client app', example: 'main-account' })
  id!: string;

  @ApiProperty({ description: 'Account label shown to clients', example: 'Main account' })
  label!: string;

  @ApiProperty({ description: 'Bank name', example: 'Saudi National Bank' })
  bankName!: string;

  @ApiProperty({ description: 'Account beneficiary name', example: 'Sawaa Family Counseling Center' })
  beneficiaryName!: string;

  @ApiProperty({ description: 'Saudi IBAN', example: 'SA0380000000608010167519' })
  iban!: string;
}

/**
 * The raw `OrganizationSettings` row.
 *
 * GET `/settings` uses `findFirst` and can therefore answer `null` when no row
 * exists; PATCH always persists and returns the row.
 *
 * `vatRate` is a Prisma `Decimal` and serializes as a decimal string, never a
 * number — the dashboard coerces it where it does arithmetic.
 */
export class OrganizationSettingsResponseDto {
  @ApiProperty({ description: 'Settings row UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Company name in Arabic', example: 'مركز سواء' })
  companyNameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Company name in English', example: 'Sawaa Center' })
  companyNameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Product tagline / subtitle', example: 'مركز الاستشارات الأسرية' })
  productTagline!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Commercial registration number', example: '1234567890' })
  businessRegistration!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'VAT registration number', example: '300000000000003' })
  vatRegistrationNumber!: string | null;

  @ApiProperty({ ...DECIMAL_STRING, description: 'VAT rate as a fraction of 1 (decimal string)', example: '0' })
  vatRate!: Prisma.Decimal;

  @ApiProperty({ type: String, nullable: true, description: 'Seller address used on invoices', example: '123 King Fahad Rd, Riyadh' })
  sellerAddress!: string | null;

  @ApiProperty({ description: 'Organization city', example: 'Riyadh' })
  organizationCity!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Postal code', example: '12345' })
  postalCode!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Contact phone number', example: '+966500000000' })
  contactPhone!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Contact email address', example: 'info@clinic.sa' })
  contactEmail!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Full address', example: 'Riyadh, Saudi Arabia' })
  address!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Free-form social media handles keyed by platform (stored as JSON)',
    example: { instagram: 'clinic_sa' },
  })
  socialMedia!: Prisma.JsonValue | null;

  @ApiProperty({ type: String, nullable: true, description: 'About text in Arabic', example: null })
  aboutAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'About text in English', example: null })
  aboutEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Privacy policy in Arabic', example: null })
  privacyPolicyAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Privacy policy in English', example: null })
  privacyPolicyEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Terms and conditions in Arabic', example: null })
  termsAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Terms and conditions in English', example: null })
  termsEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cancellation policy in Arabic', example: null })
  cancellationPolicyAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cancellation policy in English', example: null })
  cancellationPolicyEn!: string | null;

  @ApiProperty({ description: 'Default app language', example: 'ar' })
  defaultLanguage!: string;

  @ApiProperty({ description: 'IANA timezone identifier', example: 'Asia/Riyadh' })
  timezone!: string;

  @ApiProperty({ description: 'Week start day', example: 'sunday' })
  weekStartDay!: string;

  @ApiProperty({ description: 'Date format string', example: 'DD/MM/YYYY' })
  dateFormat!: string;

  @ApiProperty({ description: 'Time format string', example: '12h' })
  timeFormat!: string;

  @ApiProperty({ description: 'Show clinic logo in email header', example: true })
  emailHeaderShowLogo!: boolean;

  @ApiProperty({ description: 'Show clinic name in email header', example: true })
  emailHeaderShowName!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Phone number shown in email footer', example: null })
  emailFooterPhone!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Website URL shown in email footer', example: null })
  emailFooterWebsite!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Instagram handle for email footer', example: null })
  emailFooterInstagram!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Twitter/X handle for email footer', example: null })
  emailFooterTwitter!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Snapchat handle for email footer', example: null })
  emailFooterSnapchat!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'TikTok handle for email footer', example: null })
  emailFooterTiktok!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'LinkedIn URL for email footer', example: null })
  emailFooterLinkedin!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'YouTube channel URL for email footer', example: null })
  emailFooterYoutube!: string | null;

  @ApiProperty({ type: 'integer', description: 'Default session duration in minutes', example: 60 })
  sessionDuration!: number;

  @ApiProperty({ type: 'integer', description: 'Minutes before an appointment to send a reminder', example: 60 })
  reminderBeforeMinutes!: number;

  @ApiProperty({ description: 'Booking flow order', example: 'service_first' })
  bookingFlowOrder!: string;

  @ApiProperty({ description: 'Whether Moyasar online payment is enabled', example: true })
  paymentMoyasarEnabled!: boolean;

  @ApiProperty({ description: 'Whether pay-at-clinic is enabled', example: true })
  paymentAtClinicEnabled!: boolean;

  @ApiProperty({ description: 'Whether client bank transfer is enabled', example: false })
  paymentBankTransferEnabled!: boolean;

  @ApiProperty({
    type: [BankTransferAccountResponseDto],
    description:
      'Bank accounts stored by PATCH /settings as JSON; the column defaults to an empty array and holds the validated write payload',
  })
  bankTransferAccounts!: Prisma.JsonValue;

  @ApiProperty({ description: 'Whether "Cash" appears in the record-payment dialog', example: true })
  payMethodCashEnabled!: boolean;

  @ApiProperty({ description: 'Whether "Bank transfer" appears in the record-payment dialog', example: true })
  payMethodBankEnabled!: boolean;

  @ApiProperty({ description: 'Whether "Network/mada" appears in the record-payment dialog', example: false })
  payMethodMadaEnabled!: boolean;

  @ApiProperty({ description: 'Whether "Tabby" appears in the record-payment dialog', example: false })
  payMethodTabbyEnabled!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Custom-domain grace deadline set when CUSTOM_DOMAIN is revoked', example: null })
  customDomainGraceUntil!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

// ── Booking settings ────────────────────────────────────────────────────────

/**
 * The booking-policy values without row identity.
 *
 * `GetBookingSettingsHandler` falls back to `DEFAULT_BOOKING_SETTINGS`
 * (`ResolvedBookingSettings`) when no row exists, so a read can legitimately
 * return exactly these keys and nothing else.
 */
export class BookingSettingsValuesDto {
  @ApiProperty({ description: 'Whether the explicit client cancellation policy is enabled', example: false })
  clientCancellationPolicyEnabled!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ClientCancelCutoffMode,
    description: 'Client cancellation eligibility cutoff',
    example: null,
  })
  clientCancelCutoffMode!: ClientCancelCutoffMode | null;

  @ApiProperty({ type: 'integer', nullable: true, minimum: 0, description: 'Minimum hours before start to allow client cancellation', example: null })
  clientCancelBeforeHours!: number | null;

  @ApiProperty({ type: 'integer', nullable: true, minimum: 0, maximum: 100, description: 'Independent early cancellation partial refund percentage', example: null })
  earlyCancelRefundPercent!: number | null;

  @ApiProperty({ type: 'integer', description: 'Buffer time between bookings in minutes', example: 0 })
  bufferMinutes!: number;

  @ApiProperty({ type: 'integer', description: 'Hours before start that free cancellation is allowed', example: 24 })
  freeCancelBeforeHours!: number;

  @ApiProperty({ description: 'Refund type when the free cancellation window is used', enum: RefundType, example: RefundType.FULL })
  freeCancelRefundType!: RefundType;

  @ApiProperty({ type: 'integer', description: 'Percentage refunded on late cancellation', example: 0 })
  lateCancelRefundPercent!: number;

  @ApiProperty({ type: 'integer', description: 'Maximum number of reschedules allowed per booking', example: 3 })
  maxReschedulesPerBooking!: number;

  @ApiProperty({ type: 'integer', description: 'Hours after booking start to auto-complete the booking; 0 disables', example: 2 })
  autoCompleteAfterHours!: number;

  @ApiProperty({ type: 'integer', description: 'Minutes of grace before auto no-show; 0 disables', example: 30 })
  autoNoShowAfterMinutes!: number;

  @ApiProperty({ description: 'Whether the auto no-show grace is measured from the appointment end', example: true })
  autoNoShowAfterEnd!: boolean;

  @ApiProperty({ type: 'integer', description: 'Minimum lead time in minutes before a booking can be created', example: 60 })
  minBookingLeadMinutes!: number;

  @ApiProperty({ type: 'integer', description: 'Maximum days in advance a booking can be made', example: 90 })
  maxAdvanceBookingDays!: number;

  @ApiProperty({ description: 'Whether the pay-at-clinic option is enabled on client surfaces', example: false })
  payAtClinicEnabled!: boolean;

  @ApiProperty({ description: 'Whether cancellations require staff approval', example: false })
  requireCancelApproval!: boolean;

  @ApiProperty({ description: 'Whether a cancellation is refunded automatically', example: true })
  autoRefundOnCancel!: boolean;

  @ApiProperty({ type: 'integer', description: 'Minimum hours before start that a client may reschedule', example: 24 })
  clientRescheduleMinHoursBefore!: number;
}

/** A raw persisted `BookingSettings` row: the policy values plus row identity. */
export class BookingSettingsRecordResponseDto extends BookingSettingsValuesDto {
  @ApiProperty({ description: 'Booking settings row UUID', example: '00000000-0000-4000-a000-000000000030' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Branch UUID; null is the global default row', example: null })
  branchId!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

// ── Ratings ─────────────────────────────────────────────────────────────────

/** A raw `Rating` row returned by POST `/ratings`. */
export class OrganizationRatingRecordResponseDto {
  @ApiProperty({ description: 'Rating UUID', example: '55555555-5555-4555-8555-555555555555' })
  id!: string;

  @ApiProperty({ description: 'Rated booking UUID', example: '44444444-4444-4444-8444-444444444444' })
  bookingId!: string;

  @ApiProperty({ description: 'Client UUID', example: '22222222-2222-4222-8222-222222222222' })
  clientId!: string;

  @ApiProperty({ description: 'Employee UUID', example: '33333333-3333-4333-8333-333333333333' })
  employeeId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, description: 'Rating score from one to five stars', example: 5 })
  score!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Client feedback text', example: 'Helpful session' })
  comment!: string | null;

  @ApiProperty({ description: 'Whether the rating is approved for public display', example: false })
  isPublic!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Rating submission time', example: '2026-10-10T09:00:00.000Z' })
  createdAt!: Date;
}

/** Response of PATCH `/ratings/:id/visibility`. */
export class OrganizationRatingVisibilityResponseDto {
  @ApiProperty({ description: 'Rating UUID', example: '55555555-5555-4555-8555-555555555555' })
  id!: string;

  @ApiProperty({ description: 'Whether the rating is visible publicly', example: true })
  isPublic!: boolean;
}
