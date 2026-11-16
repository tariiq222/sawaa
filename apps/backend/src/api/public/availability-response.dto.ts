import { ApiProperty } from '@nestjs/swagger';

/** One bookable window returned by `GET /public/employees/:id/availability`. */
export class PublicAvailabilitySlotDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Slot start as an ISO 8601 UTC timestamp', example: '2026-05-20T07:00:00.000Z' })
  startTime!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Slot end as an ISO 8601 UTC timestamp', example: '2026-05-20T07:45:00.000Z' })
  endTime!: Date;
}

/** One day of the date strip returned by `GET /public/employees/:id/availability/days`. */
export class PublicAvailabilityDayDto {
  @ApiProperty({ description: 'Calendar day in the business timezone (YYYY-MM-DD)', example: '2026-05-20' })
  date!: string;

  @ApiProperty({ description: 'Whether the day has at least one open slot for the requested context', example: true })
  hasSlots!: boolean;
}
