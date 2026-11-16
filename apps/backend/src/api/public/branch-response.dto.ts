import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shapes for the public branch routes
 * (`PublicBranchesController`). Documentation-only: the handlers' Prisma
 * projections produce the payloads, and these classes never touch it.
 */

/** One active branch row of `GET /public/branches`. */
export class PublicBranchListItemDto {
  @ApiProperty({ format: 'uuid', description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Arabic branch name', example: 'الفرع الرئيسي' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English branch name, or null', example: 'Main Branch' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'City, or null', example: 'Riyadh' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic street address, or null', example: 'شارع الملك فهد' })
  addressAr!: string | null;

  @ApiProperty({ description: 'Whether this is the centre main branch (main branch sorts first)', example: true })
  isMain!: boolean;
}

/** One weekly business-hours row of a branch. */
export class PublicBusinessHourDto {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 6, description: 'Day of week (0=Sunday … 6=Saturday)', example: 0 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Opening time (HH:mm)', example: '09:00' })
  startTime!: string;

  @ApiProperty({ description: 'Closing time (HH:mm)', example: '17:00' })
  endTime!: string;

  @ApiProperty({ description: 'Whether the branch is open that day', example: true })
  isOpen!: boolean;
}

/** `GET /public/branches/:id` — the public-safe branch detail. */
export class PublicBranchDetailDto extends PublicBranchListItemDto {
  @ApiProperty({ type: String, nullable: true, description: 'English street address, or null', example: 'King Fahd Road' })
  addressEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Public phone number, or null', example: '+966112345678' })
  phone!: string | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Latitude, or null', example: 24.7136 })
  latitude!: number | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Longitude, or null', example: 46.6753 })
  longitude!: number | null;

  @ApiProperty({ description: 'IANA timezone the branch schedules in', example: 'Asia/Riyadh' })
  timezone!: string;

  @ApiProperty({ type: [PublicBusinessHourDto], description: 'Weekly business hours ordered by dayOfWeek' })
  businessHours!: PublicBusinessHourDto[];
}

/** One employee of `GET /public/branches/:id/employees`. */
export class PublicBranchEmployeeDto {
  @ApiProperty({ format: 'uuid', description: 'Employee UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Public URL slug, or null', example: 'dr-ahmed' })
  slug!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic display name, or null', example: 'أحمد الغامدي' })
  nameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English display name, or null', example: 'Ahmed Al-Ghamdi' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Job title, or null', example: 'Family Therapist' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Specialty, or null', example: 'Family Therapy' })
  specialty!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic specialty, or null', example: 'علاج أسري' })
  specialtyAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic public bio, or null', example: null })
  publicBioAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English public bio, or null', example: null })
  publicBioEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Public profile image URL (normalized/signature-renewing), or null', example: null })
  publicImageUrl!: string | null;
}
