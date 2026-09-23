import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, IsBoolean, Length, Matches, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SAUDI_PHONE_REGEX, SAUDI_PHONE_ERROR_AR } from '@sawaa/shared/validators/phone';
import { NormalizePhone } from '../shared/normalize-phone.transform';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

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
  @Matches(SAUDI_PHONE_REGEX, { message: SAUDI_PHONE_ERROR_AR })
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

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'رابط الصورة الشخصية غير صالح' })
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Preferred app locale', enum: ['ar', 'en'], example: 'ar' })
  @Type(() => Object)
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['ar', 'en'], { message: 'اللغة المفضلة غير صالحة' })
  preferredLocale?: 'ar' | 'en';

  @ApiPropertyOptional({ description: 'Whether push notifications are enabled', example: true })
  @Type(() => Object)
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean({ message: 'قيمة الإشعارات الفورية يجب أن تكون منطقية' })
  pushEnabled?: boolean;
}
