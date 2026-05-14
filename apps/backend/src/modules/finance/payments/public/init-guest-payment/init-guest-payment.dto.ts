import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitGuestPaymentDto {
  @ApiProperty({ description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  bookingId!: string;
}