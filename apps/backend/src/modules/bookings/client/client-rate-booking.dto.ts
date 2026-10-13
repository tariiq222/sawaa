import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Body for `POST /client/bookings/:id/rate`. */
export class ClientRateBookingDto {
  @ApiProperty({ description: 'Rating score from 1 to 5', example: 5 })
  @IsInt() @Min(1) @Max(5) score!: number;

  @ApiPropertyOptional({ description: 'Optional comment (max 2000 chars)' })
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;

  @ApiPropertyOptional({ description: 'Make this rating publicly visible' })
  @IsOptional() @IsBoolean() isPublic?: boolean;
}
