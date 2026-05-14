// email-provider — trigger a test email to verify the configured provider.

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class TestEmailConfigDto {
  @ApiProperty({
    description: 'Email address to send the test message to',
    example: 'owner@clinic.com',
  })
  @IsEmail()
  toEmail!: string;
}
