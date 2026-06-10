import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizePhone } from '../shared/normalize-phone.transform';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Saudi phone only: +966 then 5 then 8 digits (local number 5XXXXXXXX) —
// same policy as the dashboard clients update DTO.
const PHONE_REGEX = /^\+9665\d{8}$/;

export class UpdateClientProfileDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'أحمد محمد العتيبي' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'الاسم يجب أن يكون بين 2 و 120 حرفاً' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Saudi mobile number (any common format; normalized to E.164)',
    example: '+966501234567',
  })
  @IsOptional()
  @IsString()
  @NormalizePhone()
  @Matches(PHONE_REGEX, { message: 'رقم الجوال يجب أن يكون رقماً سعودياً بصيغة ‎+9665XXXXXXXX' })
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Email address. Can only be set while the account has no email yet (phone-registered accounts adding an email later).',
    example: 'client@example.com',
  })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;
}
