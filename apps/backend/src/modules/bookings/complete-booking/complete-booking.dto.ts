import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteBookingDto {
  @ApiPropertyOptional({ description: 'Notes recorded at booking completion', example: 'Session completed successfully' })
  @IsOptional() @IsString() completionNotes?: string;
}
