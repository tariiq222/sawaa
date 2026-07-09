import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestDashboardOtpDto {
  @ApiProperty({
    description: 'Email address or Saudi mobile number (E.164 format)',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  identifier!: string;

  @ApiPropertyOptional({ description: 'Short-lived password-step proof required only for super-admin 2FA', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  twoFactorChallenge?: string;
}
