import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';

// ── Client ─────────────────────────────────────────────────────────────────

export class ClientBookingSummaryDto {
  @ApiProperty({ description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Booking date (ISO 8601)', type: String, format: 'date-time', example: '2026-06-01T09:00:00.000Z' })
  date!: string;

  @ApiProperty({
    description: 'Booking status (uppercase)',
    enum: ['PENDING', 'PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'CANCEL_REQUESTED', 'DEPOSIT_PAID'],
    example: 'CONFIRMED',
  })
  status!: 'PENDING' | 'PENDING_GROUP_FILL' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'EXPIRED' | 'CANCEL_REQUESTED' | 'DEPOSIT_PAID';
}

/**
 * Client record as seen by an EMPLOYEE-role caller of GET list/detail: exactly
 * the keys `serializeEmployeeClient` emits (modules/people/clients/client.serializer.ts).
 * Medical, identity, consent and auth-state fields are deliberately withheld.
 * The name avoids `EmployeeClientResponseDto`, which the mobile employee API
 * already registers as a different OpenAPI schema.
 */
export class EmployeeScopedClientResponseDto {
  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ description: 'Sequential client reference', example: 1024 })
  ref!: number;

  @ApiProperty({ description: 'Full display name', example: 'Sara Al-Harbi' })
  name!: string;

  @ApiProperty({ description: 'First name', type: String, example: 'Sara', nullable: true })
  firstName!: string | null;

  @ApiProperty({ description: 'Last name', type: String, example: 'Al-Harbi', nullable: true })
  lastName!: string | null;

  @ApiProperty({ description: 'Mobile phone number', type: String, example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Email address', type: String, example: 'sara@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ description: 'Date of birth (ISO 8601)', type: String, format: 'date-time', example: '1990-06-15T00:00:00.000Z', nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty({ description: 'Gender (lowercase)', example: 'female', enum: ['male', 'female'], nullable: true })
  gender!: 'male' | 'female' | null;

  @ApiProperty({ description: 'Avatar image URL', type: String, example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Account type', example: 'full', enum: ['full', 'walk_in'] })
  accountType!: 'full' | 'walk_in';

  @ApiProperty({ description: 'Whether the account is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Most recent past booking (populated for list results; null on detail, create and update)', type: ClientBookingSummaryDto, nullable: true })
  lastBooking!: ClientBookingSummaryDto | null;

  @ApiProperty({ description: 'Next future booking (populated for list results; null on detail, create and update)', type: ClientBookingSummaryDto, nullable: true })
  nextBooking!: ClientBookingSummaryDto | null;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * Full client record (`serializeClient`): the employee-scoped fields plus the
 * staff-only ones. Returned to every non-EMPLOYEE caller, and by create and
 * update for all callers.
 */
export class ClientResponseDto extends EmployeeScopedClientResponseDto {
  @ApiProperty({ description: 'Linked user UUID', type: String, example: '00000000-0000-0000-0000-000000000001', nullable: true })
  userId!: string | null;

  @ApiProperty({ description: 'Middle name', type: String, example: 'Ali', nullable: true })
  middleName!: string | null;

  @ApiProperty({ description: 'Email verification timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', nullable: true })
  emailVerified!: Date | null;

  @ApiProperty({ description: 'Phone verification timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', nullable: true })
  phoneVerified!: Date | null;

  @ApiProperty({ description: 'Nationality', type: String, example: 'Saudi', nullable: true })
  nationality!: string | null;

  @ApiProperty({ description: 'National ID or Iqama number', type: String, example: '1234567890', nullable: true })
  nationalId!: string | null;

  @ApiProperty({ description: 'Emergency contact name', type: String, example: 'Ahmad Al-Harbi', nullable: true })
  emergencyName!: string | null;

  @ApiProperty({ description: 'Emergency contact phone number', type: String, example: '+966501234567', nullable: true })
  emergencyPhone!: string | null;

  @ApiProperty({ description: 'Blood type (uppercase)', enum: ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'], example: 'A_POS', nullable: true })
  bloodType!: 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG' | 'UNKNOWN' | null;

  @ApiProperty({ description: 'Known allergies', type: String, example: 'Penicillin', nullable: true })
  allergies!: string | null;

  @ApiProperty({ description: 'Chronic conditions', type: String, example: 'Type 2 Diabetes', nullable: true })
  chronicConditions!: string | null;

  @ApiProperty({ description: 'Internal notes about the client', type: String, example: 'Prefers morning appointments', nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Acquisition source (uppercase)', enum: ['WALK_IN', 'ONLINE', 'REFERRAL', 'WHATSAPP'], example: 'WALK_IN' })
  source!: 'WALK_IN' | 'ONLINE' | 'REFERRAL' | 'WHATSAPP';

  @ApiProperty({ description: 'Account claim timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', nullable: true })
  claimedAt!: Date | null;

  @ApiProperty({ description: 'Soft deletion timestamp', type: String, format: 'date-time', example: null, nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ description: 'Last login timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ description: 'Preferred locale (ISO 639-1)', type: String, example: 'ar', nullable: true })
  preferredLocale!: string | null;

  @ApiProperty({ description: 'Whether push notifications are enabled', example: true })
  pushEnabled!: boolean;

  @ApiProperty({ description: 'Privacy consent timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', nullable: true })
  consentedAt!: Date | null;

  @ApiProperty({ description: 'Accepted privacy consent version', type: String, example: '2026-01', nullable: true })
  consentVersion!: string | null;
}

/**
 * GET clients and GET clients/:id return one of two shapes depending on the
 * caller's role: EMPLOYEE gets `EmployeeScopedClientResponseDto`
 * (`serializeEmployeeClient`), every other role gets `ClientResponseDto`
 * (`serializeClient`). See modules/people/clients/client.serializer.ts.
 */
export type ClientReadResponseDto = ClientResponseDto | EmployeeScopedClientResponseDto;
export const CLIENT_READ_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(ClientResponseDto) },
    { $ref: getSchemaPath(EmployeeScopedClientResponseDto) },
  ],
};

export class CreateClientResponseDto extends ClientResponseDto {
  @ApiProperty({ description: 'Whether an existing client was returned by phone deduplication', example: false })
  isExisting!: boolean;
}

// ── Employee ────────────────────────────────────────────────────────────────

/**
 * Employee READ projection produced by `mapEmployeeRow`
 * (modules/people/employees/employee-row.mapper.ts) for GET list/detail. Every
 * property is always emitted; `avatarUrl` is replaced with a readable signed
 * URL by the handlers.
 */
export class EmployeeResponseDto {
  @ApiProperty({ description: 'Public directory slug', type: String, nullable: true, example: null })
  slug!: string | null;

  @ApiProperty({ description: 'Whether the employee is published in the directory', example: false })
  isPublic!: boolean;

  @ApiProperty({ description: 'Public biography in Arabic', type: String, nullable: true, example: null })
  publicBioAr!: string | null;

  @ApiProperty({ description: 'Public biography in English', type: String, nullable: true, example: null })
  publicBioEn!: string | null;

  @ApiProperty({ description: 'Readable selected public portrait URL', type: String, nullable: true, example: null })
  publicImageUrl!: string | null;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Sequential employee reference', example: 1024 })
  ref!: number;

  @ApiProperty({ description: 'Linked user UUID', type: String, example: '00000000-0000-0000-0000-000000000000', nullable: true })
  userId!: string | null;

  @ApiProperty({ description: 'Full display name', example: 'Dr. Khalid Al-Otaibi' })
  name!: string;

  @ApiProperty({ description: 'Arabic name', type: String, example: 'خالد العتيبي', nullable: true })
  nameAr!: string | null;

  @ApiProperty({ description: 'English name', type: String, example: 'Khalid Al-Otaibi', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Job title', type: String, example: 'Senior Therapist', nullable: true })
  title!: string | null;

  @ApiProperty({ description: 'Specialty label', type: String, example: 'Family Therapy', nullable: true })
  specialty!: string | null;

  @ApiProperty({ description: 'Specialty label in Arabic', type: String, nullable: true, example: 'علاج أسري' })
  specialtyAr!: string | null;

  @ApiProperty({ description: 'Gender (uppercase enum)', enum: ['MALE', 'FEMALE'], nullable: true, example: 'MALE' })
  gender!: EmployeeGender | null;

  @ApiProperty({ description: 'Short biography in English', type: String, nullable: true, example: 'Family therapist with 10 years of experience.' })
  bio!: string | null;

  @ApiProperty({ description: 'Short biography in Arabic', type: String, nullable: true, example: 'معالج أسري بخبرة 10 سنوات.' })
  bioAr!: string | null;

  @ApiProperty({ description: 'Education details in English', type: String, nullable: true, example: 'King Saud University' })
  education!: string | null;

  @ApiProperty({ description: 'Education details in Arabic', type: String, nullable: true, example: 'جامعة الملك سعود' })
  educationAr!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Years of experience', example: 8 })
  experience!: number | null;

  @ApiProperty({ description: 'Phone number', type: String, example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Email address', type: String, example: 'khalid@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ description: 'Avatar URL', type: String, example: 'https://cdn.example.com/avatars/khalid.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Employment type',
    enum: Object.values(EmploymentType),
    example: 'FULL_TIME',
  })
  employmentType!: EmploymentType;

  @ApiProperty({
    description: 'Onboarding status',
    enum: Object.values(OnboardingStatus),
    example: 'COMPLETED',
  })
  onboardingStatus!: OnboardingStatus;

  @ApiProperty({ description: 'Whether the employee is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Employee activation permits booking admission; does not guarantee a free slot', example: true })
  isAcceptingBookings!: boolean;


  @ApiProperty({ description: 'Average rating (0–5)', type: Number, example: 4.7, nullable: true })
  averageRating!: number | null;

  @ApiProperty({ description: 'Total rating count', example: 32 })
  ratingCount!: number;

  @ApiProperty({ description: 'Total booking count', example: 120 })
  bookingCount!: number;

  @ApiProperty({ description: 'Assigned branch UUIDs', type: [String] })
  branchIds!: string[];

  @ApiProperty({ description: 'Assigned service UUIDs', type: [String] })
  serviceIds!: string[];

  @ApiProperty({
    type: 'array',
    description: 'Active weekly availability windows, ordered by day',
    items: {
      type: 'object',
      properties: {
        dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, example: 1 },
        startTime: { type: 'string', example: '09:00' },
        endTime: { type: 'string', example: '17:00' },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  availability!: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

// ── Pagination meta ─────────────────────────────────────────────────────────

export class ListMetaDto {
  @ApiProperty({ description: 'Total matching records', example: 42 })
  total!: number;

  @ApiProperty({ description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Records per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

export class PaginatedClientsDto {
  @ApiProperty({ type: 'array', items: CLIENT_READ_SCHEMA, description: 'Clients on the requested page' })
  items!: ClientReadResponseDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata for the full result set' })
  meta!: ListMetaDto;
}

export class PaginatedEmployeesDto {
  @ApiProperty({ type: [EmployeeResponseDto], description: 'Employees on the requested page' })
  items!: EmployeeResponseDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata for the full result set' })
  meta!: ListMetaDto;
}

// ── Employee stats ──────────────────────────────────────────────────────────

export class EmployeeStatsResponseDto {
  @ApiProperty({ description: 'Total employee count', example: 15 })
  total!: number;

  @ApiProperty({ description: 'Active employee count', example: 12 })
  active!: number;

  @ApiProperty({ description: 'Inactive employee count', example: 3 })
  inactive!: number;

  @ApiProperty({ description: 'Average rating across all employees', type: Number, example: 4.5, nullable: true })
  avgRating!: number | null;
}

// ── Set-client-active result ────────────────────────────────────────────────

export class SetClientActiveResponseDto {
  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ description: 'New active state', example: true })
  isActive!: boolean;
}

// ── Upload-avatar result ────────────────────────────────────────────────────

export class UploadAvatarResponseDto {
  @ApiProperty({ description: 'Stored file UUID', example: '00000000-0000-0000-0000-000000000000' })
  fileId!: string;

  @ApiProperty({ description: 'Public URL of the uploaded avatar', example: 'https://cdn.example.com/avatars/emp.jpg' })
  url!: string;
}

// ── Public employee ─────────────────────────────────────────────────────────

export class PublicEmployeeResponseDto {
  @ApiProperty({ description: 'Spoken languages', type: [String], example: ['العربية', 'English'] })
  languages!: string[];

  @ApiProperty({ description: 'Years of experience', example: 8 })
  experience!: number;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiPropertyOptional({ description: 'Public URL slug', example: 'dr-ahmed', nullable: true })
  slug!: string | null;

  @ApiPropertyOptional({ description: 'Arabic display name', example: 'أحمد الغامدي', nullable: true })
  nameAr!: string | null;

  @ApiPropertyOptional({ description: 'English display name', example: 'Ahmed Al-Ghamdi', nullable: true })
  nameEn!: string | null;

  @ApiPropertyOptional({ description: 'Job title', example: 'Family Therapist', nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ description: 'Specialty', example: 'Family Therapy', nullable: true })
  specialty!: string | null;

  @ApiPropertyOptional({ description: 'Arabic specialty', nullable: true })
  specialtyAr!: string | null;

  @ApiPropertyOptional({ description: 'Arabic public bio', nullable: true })
  publicBioAr!: string | null;

  @ApiPropertyOptional({ description: 'English public bio', nullable: true })
  publicBioEn!: string | null;

  @ApiPropertyOptional({ description: 'Public profile image URL', nullable: true })
  publicImageUrl!: string | null;

  @ApiPropertyOptional({ description: 'Gender', nullable: true })
  gender!: string | null;

  @ApiProperty({ description: 'Employment type', example: 'FULL_TIME' })
  employmentType!: string;

  @ApiPropertyOptional({ description: 'Average public rating', example: 4.8, nullable: true })
  ratingAverage!: number | null;

  @ApiProperty({ description: 'Public rating count', example: 18 })
  ratingCount!: number;

  @ApiPropertyOptional({ description: 'Minimum service price in SAR', example: 250, nullable: true })
  minServicePrice!: number | null;

  @ApiProperty({ description: 'Whether employee has availability today', example: true })
  isAvailableToday!: boolean;

  @ApiProperty({ description: 'Service ids this employee can deliver', example: ['svc_1'], type: [String] })
  serviceIds!: string[];

  @ApiProperty({ description: 'Branch ids this employee works from', example: ['br_1'], type: [String] })
  branchIds!: string[];

  @ApiProperty({ description: 'True only if employee has ≥1 service, ≥1 branch, and ≥1 active availability rule', example: true })
  isBookable!: boolean;

  @ApiProperty({ description: 'Days of week (0=Sun..6=Sat) the employee has at least one active availability rule on', example: [0, 1, 2, 3, 4], type: [Number] })
  availableDaysOfWeek!: number[];
}
