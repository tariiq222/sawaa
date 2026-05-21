import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectCancelBookingDto {
  @ApiProperty({ description: 'Reason for rejecting the cancel request', example: 'Outside cancellation window' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rejectReason!: string;
}
