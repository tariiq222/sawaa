import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { NormalizePhoneOrEmail } from '../shared/normalize-phone.transform';

export class RequestMobileLoginOtpDto {
  @ApiProperty({ description: 'Phone (E.164) or email', example: '+966501234567' })
  @IsString()
  @MinLength(3)
  @NormalizePhoneOrEmail()
  identifier!: string;

  @ApiPropertyOptional({
    description: 'Legacy/deprecated. Ignored in single-tenant mode; backend uses the fixed deployment context.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
