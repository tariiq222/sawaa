// SaaS-02g-sms — trigger a test SMS to the owner's phone.

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TestSmsConfigDto {
  @ApiProperty({ description: 'Phone number to send the test SMS to (E.164)' })
  @IsString()
  @MinLength(5)
  toPhone!: string;
}
