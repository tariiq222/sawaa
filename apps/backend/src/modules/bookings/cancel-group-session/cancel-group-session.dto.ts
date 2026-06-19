import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelGroupSessionDto {
  @ApiPropertyOptional({ description: 'Reason for cancelling the session', example: 'Counselor unavailable' })
  @IsOptional() @IsString() cancelReason?: string;
}
