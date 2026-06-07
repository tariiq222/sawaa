import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { NormalizePhoneOrEmail } from '../shared/normalize-phone.transform';

export class VerifyOtpDto {
  @ApiProperty({ enum: OtpChannel, description: 'OTP delivery channel', example: 'EMAIL' })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({ description: 'Email address or phone number', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  @NormalizePhoneOrEmail()
  identifier!: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;

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
