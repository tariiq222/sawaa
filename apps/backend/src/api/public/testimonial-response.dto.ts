import { ApiProperty } from '@nestjs/swagger';

/**
 * One anonymized public testimonial (`ListPublicTestimonialsHandler`).
 * The client name is reduced to its first two characters plus `****` and the
 * initial is exposed separately for the avatar chip.
 */
export class PublicTestimonialResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Rating UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Public comment text', example: 'تجربة مريحة ومهنية' })
  text!: string;

  @ApiProperty({ description: 'Anonymized client name (first two characters plus ****)', example: 'سا****' })
  name!: string;

  @ApiProperty({ description: 'First character of the client name, used as an avatar initial', example: 'س' })
  letter!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, description: 'Rating score', example: 5 })
  rating!: number;

  @ApiProperty({ format: 'date-time', description: 'Rating creation instant as an ISO 8601 UTC timestamp', example: '2026-01-01T00:00:00.000Z' })
  date!: string;
}
