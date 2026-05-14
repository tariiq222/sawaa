import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Client ─────────────────────────────────────────────────────────────────

export class ClientResponseDto {
  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ description: 'Full display name', example: 'Sara Al-Harbi' })
  name!: string;

  @ApiPropertyOptional({ description: 'First name', example: 'Sara', nullable: true })
  firstName!: string | null;

  @ApiPropertyOptional({ description: 'Last name', example: 'Al-Harbi', nullable: true })
  lastName!: string | null;

  @ApiPropertyOptional({ description: 'Mobile phone number', example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'sara@example.com', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601)', example: '1990-06-15', nullable: true })
  dateOfBirth!: Date | null;

  @ApiPropertyOptional({ description: 'Gender (lowercase)', example: 'female', enum: ['male', 'female'], nullable: true })
  gender!: 'male' | 'female' | null;

  @ApiProperty({ description: 'Whether the account is active', example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ description: 'Account type', example: 'full', enum: ['full', 'walk_in'] })
  accountType!: 'full' | 'walk_in';

  @ApiProperty({ description: 'Creation timestamp', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

// ── Employee ────────────────────────────────────────────────────────────────

export class EmployeeResponseDto {
  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiPropertyOptional({ description: 'Linked user UUID', example: '00000000-0000-0000-0000-000000000000', nullable: true })
  userId!: string | null;

  @ApiProperty({ description: 'Full display name', example: 'Dr. Khalid Al-Otaibi' })
  name!: string;

  @ApiPropertyOptional({ description: 'Arabic name', example: 'خالد العتيبي', nullable: true })
  nameAr!: string | null;

  @ApiPropertyOptional({ description: 'English name', example: 'Khalid Al-Otaibi', nullable: true })
  nameEn!: string | null;

  @ApiPropertyOptional({ description: 'Job title', example: 'Senior Therapist', nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ description: 'Specialty label', example: 'Family Therapy', nullable: true })
  specialty!: string | null;

  @ApiPropertyOptional({ description: 'Phone number', example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'khalid@example.com', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ description: 'Avatar URL', example: 'https://cdn.example.com/avatars/khalid.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Employment type', example: 'FULL_TIME' })
  employmentType!: string;

  @ApiProperty({ description: 'Onboarding status', example: 'COMPLETED' })
  onboardingStatus!: string;

  @ApiProperty({ description: 'Whether the employee is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Average rating (0–5)', example: 4.7, nullable: true })
  averageRating!: number | null;

  @ApiProperty({ description: 'Total rating count', example: 32 })
  ratingCount!: number;

  @ApiProperty({ description: 'Total booking count', example: 120 })
  bookingCount!: number;

  @ApiProperty({ description: 'Assigned branch UUIDs', type: [String] })
  branchIds!: string[];

  @ApiProperty({ description: 'Assigned service UUIDs', type: [String] })
  serviceIds!: string[];

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
  perPage!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

export class PaginatedClientsDto {
  @ApiProperty({ type: [ClientResponseDto] })
  items!: ClientResponseDto[];

  @ApiProperty({ type: ListMetaDto })
  meta!: ListMetaDto;
}

export class PaginatedEmployeesDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  items!: EmployeeResponseDto[];

  @ApiProperty({ type: ListMetaDto })
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

  @ApiPropertyOptional({ description: 'Average rating across all employees', example: 4.5, nullable: true })
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
}
