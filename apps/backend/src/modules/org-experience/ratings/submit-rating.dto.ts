import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitRatingDto {
  @ApiProperty({ description: 'Booking UUID being rated', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID() bookingId!: string;

  @ApiProperty({ description: 'Client UUID submitting the rating', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee UUID being rated', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Rating score from 1 to 5', minimum: 1, maximum: 5, example: 5 })
  @IsInt() @Min(1) @Max(5) score!: number;

  @ApiPropertyOptional({ description: 'Optional comment (max 2000 chars)', example: 'Great service!' })
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;

  @ApiPropertyOptional({ description: 'Whether the rating is visible publicly', example: true })
  @IsOptional() @IsBoolean() isPublic?: boolean;
}
