import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({ description: 'Recipient phone number in E.164 format', example: '+966501234567' })
  @IsString() @MinLength(5) phone!: string;

  @ApiProperty({ description: 'SMS message body', example: 'Your booking is confirmed for tomorrow at 10 AM.' })
  @IsString() @MinLength(1) body!: string;
}
