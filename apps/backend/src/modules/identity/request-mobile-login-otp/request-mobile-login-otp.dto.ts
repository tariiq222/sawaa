import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { NormalizePhoneOrEmail } from '../shared/normalize-phone.transform';

export class RequestMobileLoginOtpDto {
  @ApiProperty({ description: 'Phone (E.164) or email', example: '+966501234567' })
  @IsString()
  @MinLength(3)
  @NormalizePhoneOrEmail()
  identifier!: string;
}
