import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveCancelBookingDto {
  @ApiPropertyOptional({ description: 'Optional notes from the approver', example: 'Approved per client request' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approverNotes?: string;
}
