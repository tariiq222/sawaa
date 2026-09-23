import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
  @ApiProperty({ description: 'FCM registration token (not an APNs or Expo token)', example: 'eXampleToken123' })
  @IsString() @IsNotEmpty() @MaxLength(512)
  token!: string;

  @ApiProperty({ description: 'Device platform', enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
