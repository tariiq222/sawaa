import { ApiProperty } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';

/**
 * Response shapes of the dashboard program endpoints
 * (`programs.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Every property is traced to a handler and its Prisma
 * `select`/`include`; `program-response.dto.spec.ts` asserts each handler result
 * is exactly its DTO.
 *
 * `GET /programs/:id` keeps its own `ProgramDetailResponseDto` (already in the
 * committed snapshot). Money that Prisma stores as `Decimal` is serialized with
 * `.toString()`, so `price`/`depositAmount` are decimal strings, never numbers.
 * The enrollment route is deliberately undocumented here: it creates a booking
 * and an invoice, which is finance-adjacent, so this unit leaves it untouched.
 */

const UUID_EXAMPLE = '66666666-6666-4666-8666-666666666666';
const DEPARTMENT_EXAMPLE = '77777777-7777-4777-8777-777777777777';
const BRANCH_EXAMPLE = '88888888-8888-4888-8888-888888888888';
const SUPERVISOR_EXAMPLE = '33333333-3333-4333-8333-333333333333';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** One row of `GET /dashboard/programs` (`ListProgramsHandler.execute`). */
export class ProgramListItemResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Unique program identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Numeric program reference accepted by the detail lookup', example: 24 })
  ref!: number;

  @ApiProperty({ description: 'Arabic program name', example: 'برنامج التواصل الأسري' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English program name, or null when unspecified', example: 'Family Communication Program' })
  nameEn!: string | null;

  @ApiProperty({ format: 'uuid', description: 'Department that owns the program', example: DEPARTMENT_EXAMPLE })
  departmentId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch where the program is offered', example: BRANCH_EXAMPLE })
  branchId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Program start time as an ISO 8601 UTC timestamp, or null when unscheduled', example: null })
  startDate!: Date | null;

  @ApiProperty({ type: 'integer', description: 'Number of program days', example: 3 })
  daysCount!: number;

  @ApiProperty({ type: 'integer', description: 'Number of program hours per day', example: 2 })
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

  @ApiProperty({ type: String, nullable: true, description: 'Deposit in integer halalas as a decimal string, or null when no deposit is set', example: '30000' })
  depositAmount!: string | null;

  @ApiProperty({ enum: ProgramStatus, description: 'Current program lifecycle status', example: 'OPEN' })
  status!: ProgramStatus;

  @ApiProperty({ description: 'Whether the program is published in the public catalog', example: true })
  isPublic!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Cancellation time as an ISO 8601 UTC timestamp, or null when not cancelled', example: null })
  cancelledAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Program creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: [String], description: 'Identifiers of employees supervising the program', example: [SUPERVISOR_EXAMPLE] })
  supervisorIds!: string[];

  @ApiProperty({ description: 'Whether enrolled count has reached the maximum participant capacity', example: false })
  isFull!: boolean;

  @ApiProperty({ type: 'integer', description: 'Total enrollment rows attached to the program (the list joins them to build this counter)', example: 1 })
  enrollmentCount!: number;
}

/**
 * `POST /dashboard/programs` and `PATCH /dashboard/programs/:id` return only the
 * persisted identity plus the resulting lifecycle state and supervisor set —
 * not the full program row (`CreateProgramHandler` / `UpdateProgramHandler`).
 */
export class ProgramWriteResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Unique program identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'Numeric program reference accepted by the detail lookup', example: 24 })
  ref!: number;

  @ApiProperty({ enum: ProgramStatus, description: 'Program lifecycle status after the write', example: 'DRAFT' })
  status!: ProgramStatus;

  @ApiProperty({ type: [String], description: 'Identifiers of employees supervising the program after the write', example: [SUPERVISOR_EXAMPLE] })
  supervisorIds!: string[];
}

/** `PATCH /dashboard/programs/:id/publish` (`PublishProgramHandler.execute`). */
export class ProgramPublishResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Unique program identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: ProgramStatus, description: 'Program lifecycle status after publishing', example: 'OPEN' })
  status!: ProgramStatus;
}

/** `PATCH /dashboard/programs/:id/schedule` (`ScheduleProgramHandler.execute`). */
export class ProgramScheduleResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Unique program identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: ProgramStatus, description: 'Program lifecycle status after scheduling', example: 'SCHEDULED' })
  status!: ProgramStatus;

  @ApiProperty({ type: String, format: 'date-time', description: 'Scheduled program start time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  startDate!: Date;
}
