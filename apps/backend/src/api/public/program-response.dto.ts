import { ApiProperty } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';

/**
 * Swagger response shapes for the PUBLIC program routes
 * (`PublicProgramsController`, `public/programs`).
 *
 * Documentation-only: the handlers map the persisted `Program` row into these
 * objects, and the classes are never instantiated.
 *
 * Two shapes are deliberately distinct: the list row omits
 * `isOpenForEnrollment` (the list filter already guarantees OPEN|MIN_REACHED),
 * while the detail row adds it as a computed convenience flag.
 */

const UUID_EXAMPLE = '66666666-6666-4666-8666-666666666666';
const DEPARTMENT_EXAMPLE = '77777777-7777-4777-8777-777777777777';
const BRANCH_EXAMPLE = '88888888-8888-4888-8888-888888888888';
const SUPERVISOR_EXAMPLE = '33333333-3333-4333-8333-333333333333';

/** One row of `GET /public/programs` (`ListPublicProgramsHandler`). */
export class PublicProgramListItemDto {
  @ApiProperty({ format: 'uuid', description: 'Program UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Numeric program reference accepted by the detail lookup', example: 24 })
  ref!: number;

  @ApiProperty({ description: 'Arabic program name', example: 'برنامج التواصل الأسري' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English program name, or null', example: 'Family Communication Program' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description, or null', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description, or null', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic public description override, or null', example: null })
  publicDescriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English public description override, or null', example: null })
  publicDescriptionEn!: string | null;

  @ApiProperty({ format: 'uuid', description: 'Department that owns the program', example: DEPARTMENT_EXAMPLE })
  departmentId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch where the program is offered', example: BRANCH_EXAMPLE })
  branchId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Program start time as an ISO 8601 UTC timestamp, or null when unscheduled', example: null })
  startDate!: Date | null;

  @ApiProperty({ type: 'integer', description: 'Number of program days', example: 3 })
  daysCount!: number;

  @ApiProperty({ type: 'integer', description: 'Program hours per day', example: 2 })
  hoursPerDay!: number;

  @ApiProperty({ type: 'integer', description: 'Minimum participants required for the program', example: 3 })
  minParticipants!: number;

  @ApiProperty({ type: 'integer', description: 'Maximum number of enrolled participants', example: 12 })
  maxParticipants!: number;

  @ApiProperty({ type: 'integer', description: 'Current number of program enrollments', example: 1 })
  enrolledCount!: number;

  @ApiProperty({ description: 'Price in integer halalas, serialized as a decimal string', example: '150000' })
  price!: string;

  @ApiProperty({ description: 'Program price currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ description: 'Whether the program accepts a deposit', example: true })
  depositEnabled!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Deposit in integer halalas as a decimal string, or null when none is set', example: '30000' })
  depositAmount!: string | null;

  @ApiProperty({ enum: ProgramStatus, description: 'Current program lifecycle status', example: 'OPEN' })
  status!: ProgramStatus;

  @ApiProperty({ description: 'Whether the program is published in the public catalog', example: true })
  isPublic!: boolean;

  @ApiProperty({ type: [String], description: 'Identifiers of employees supervising the program', example: [SUPERVISOR_EXAMPLE] })
  supervisorIds!: string[];

  @ApiProperty({ description: 'Whether enrolled count has reached the maximum participant capacity', example: false })
  isFull!: boolean;
}

/** `GET /public/programs` — the handler wraps its rows in `{ programs }`. */
export class PublicProgramsListResponseDto {
  @ApiProperty({ type: [PublicProgramListItemDto], description: 'Public programs with at least one open spot', example: [] })
  programs!: PublicProgramListItemDto[];
}

/** `GET /public/programs/:id` — the list row plus the computed enrollment flag. */
export class PublicProgramDetailResponseDto extends PublicProgramListItemDto {
  @ApiProperty({ description: 'Whether the stored status still accepts self-enrollment (OPEN or MIN_REACHED)', example: true })
  isOpenForEnrollment!: boolean;
}
