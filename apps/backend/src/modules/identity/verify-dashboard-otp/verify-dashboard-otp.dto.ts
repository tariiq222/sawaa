import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyDashboardOtpDto {
  @ApiProperty({
    description: 'Email address or Saudi mobile number (E.164 format)',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  identifier!: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ description: 'Short-lived password-step proof required only for super-admin 2FA', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  twoFactorChallenge?: string;
}
