import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { NormalizePhoneOrEmail } from '../shared/normalize-phone.transform';

export enum MobileOtpPurposeDto {
  REGISTER = 'register',
  LOGIN = 'login',
}

export class VerifyMobileOtpDto {
  @ApiProperty({ description: 'Phone or email used to request the OTP' })
  @IsString()
  @MinLength(3)
  @NormalizePhoneOrEmail()
  identifier!: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ enum: MobileOtpPurposeDto, description: 'Whether this verifies a registration or a login OTP' })
  @IsEnum(MobileOtpPurposeDto)
  purpose!: MobileOtpPurposeDto;

  @ApiPropertyOptional({
    description: 'Legacy/deprecated. Ignored in single-tenant mode; backend uses the fixed deployment context.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
