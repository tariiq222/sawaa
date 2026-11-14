import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shapes of the dashboard business-hours and holiday routes
 * (`organization-hours.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Both classes are the raw Prisma rows; `organization-hours-response.dto.spec.ts`
 * asserts each one equals its `BusinessHour` / `Holiday` model exactly.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;

/** A raw `BusinessHour` row (POST `/hours` and GET `/hours/:branchId`). */
export class OrganizationHoursRecordDto {
  @ApiProperty({ description: 'Business-hour record UUID', example: '00000000-0000-4000-a000-000000000010' })
  id!: string;

  @ApiProperty({ description: 'Branch UUID the schedule belongs to', example: '00000000-0000-4000-a000-000000000001' })
  branchId!: string;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: 6, description: 'Day of week, from Sunday (0) to Saturday (6)', example: 0 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Opening time in HH:mm format', example: '09:00' })
  startTime!: string;

  @ApiProperty({ description: 'Closing time in HH:mm format', example: '17:00' })
  endTime!: string;

  @ApiProperty({ description: 'Whether the branch is open on this day', example: true })
  isOpen!: boolean;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/** A raw `Holiday` row (POST `/holidays` and GET `/holidays`). */
export class HolidayRecordDto {
  @ApiProperty({ description: 'Holiday record UUID', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ description: 'Branch UUID the holiday belongs to', example: '00000000-0000-4000-a000-000000000001' })
  branchId!: string;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Holiday date; the column is a calendar date stored at UTC midnight', example: '2026-09-23T00:00:00.000Z' })
  date!: Date;

  @ApiProperty({ description: 'Arabic holiday name', example: 'اليوم الوطني' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English holiday name', example: 'National Day' })
  nameEn!: string | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;
}
