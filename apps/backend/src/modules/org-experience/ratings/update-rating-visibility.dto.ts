import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRatingVisibilityDto {
  @ApiProperty({ description: 'Whether the rating is visible publicly', example: true })
  @IsBoolean()
  isPublic!: boolean;
}
