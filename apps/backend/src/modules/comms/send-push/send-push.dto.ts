import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendPushDto {
  @ApiProperty({ description: 'FCM device registration token', example: 'fXm3...token' })
  @IsString() @MinLength(1) token!: string;

  @ApiProperty({ description: 'Push notification title', example: 'Booking Confirmed' })
  @IsString() @MinLength(1) title!: string;

  @ApiProperty({ description: 'Push notification body text', example: 'Your appointment is tomorrow at 10 AM.' })
  @IsString() @MinLength(1) body!: string;

  @ApiPropertyOptional({ description: 'Arbitrary key-value data payload', example: { bookingId: '00000000-0000-0000-0000-000000000000' } })
  @IsOptional() @IsObject() data?: Record<string, string>;
}
