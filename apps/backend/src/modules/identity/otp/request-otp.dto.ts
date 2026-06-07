import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { NormalizePhoneOrEmail } from '../shared/normalize-phone.transform';

export class RequestOtpDto {
  @ApiProperty({ enum: OtpChannel, description: 'OTP delivery channel', example: 'EMAIL' })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({ description: 'Email address or phone number (E.164 format)', example: 'user@example.com' })
  @IsNotEmpty()
  @IsString()
  @NormalizePhoneOrEmail()
  identifier!: string;

  @ApiProperty({ enum: OtpPurpose, description: 'Purpose of the OTP', example: 'GUEST_BOOKING' })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiPropertyOptional({
    description: 'Legacy/deprecated. Ignored in single-tenant mode; backend uses the fixed deployment context.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
