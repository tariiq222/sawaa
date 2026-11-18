import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /public/bookings/{bookingId}/intake-responses`.
 *
 * Documentation only: `SubmitIntakeResponseHandler` returns the stored row
 * through `toPublicResponse` (id / bookingId / formId / clientId / answers,
 * plus `createdAt` when the row carries one). `answers` is the raw `Json`
 * column, so values are documented as free JSON rather than the narrow
 * string / string[] pair the form builder normally submits.
 */
export class PublicIntakeResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Intake response identifier', example: '00000000-4000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Booking the answers belong to', example: '00000000-4000-4000-a000-000000000002' })
  bookingId!: string;

  @ApiProperty({ format: 'uuid', description: 'Answered intake form', example: '00000000-4000-4000-a000-000000000003' })
  formId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client derived from the booking, or null', example: '00000000-4000-4000-a000-000000000004' })
  clientId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Stored answers JSON keyed by intake field id',
    example: { '11111111-1111-1111-1111-111111111111': 'نعم' },
  })
  answers!: unknown;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Creation instant of the stored row', example: '2026-10-10T09:00:00.000Z' })
  createdAt?: Date;
}
