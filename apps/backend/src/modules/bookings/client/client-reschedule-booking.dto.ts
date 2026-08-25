import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClientRescheduleBookingDto {
  @ApiProperty({ description: 'New appointment time (ISO 8601)' })
  @IsNotEmpty()
  @IsDateString()
  newScheduledAt!: string;
}
