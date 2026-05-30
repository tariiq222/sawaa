import { IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRatingVisibilityDto {
  @ApiProperty({ description: 'Rating UUID', format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Whether the rating is visible publicly', example: true })
  @IsBoolean()
  isPublic!: boolean;
}
