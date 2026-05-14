import {
  IsOptional, IsString, IsBoolean, IsNumber, IsInt,
  Min, Max, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertOrgSettingsDto {
  @ApiPropertyOptional({ description: 'Company name in Arabic', example: 'عيادة الرعاية' })
  @IsOptional() @IsString() companyNameAr?: string;

  @ApiPropertyOptional({ description: 'Company name in English', example: 'Deqah Clinic' })
  @IsOptional() @IsString() companyNameEn?: string;

  @ApiPropertyOptional({ description: 'Commercial registration number', example: '1234567890' })
  @IsOptional() @IsString() businessRegistration?: string;

  @ApiPropertyOptional({ description: 'VAT registration number (15 digits)', example: '300000000000003' })
  @IsOptional() @IsString() vatRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'VAT rate as fraction (0..1). Super-admin only.', example: 0.15 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) vatRate?: number;

  @ApiPropertyOptional({ description: 'Seller address for invoices', example: '123 King Fahad Rd, Riyadh' })
  @IsOptional() @IsString() sellerAddress?: string;

  @ApiPropertyOptional({ description: 'Organization city', example: 'Riyadh' })
  @IsOptional() @IsString() organizationCity?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '12345' })
  @IsOptional() @IsString() postalCode?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+966500000000' })
  @IsOptional() @IsString() contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact email address', example: 'info@clinic.sa' })
  @IsOptional() @IsString() contactEmail?: string;

  @ApiPropertyOptional({ description: 'Full address', example: 'Riyadh, Saudi Arabia' })
  @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional({ description: 'Social media handles keyed by platform', example: { instagram: 'clinic_sa' } })
  @IsOptional() socialMedia?: Record<string, string>;

  @ApiPropertyOptional({ description: 'About text in Arabic' })
  @IsOptional() @IsString() aboutAr?: string;

  @ApiPropertyOptional({ description: 'About text in English' })
  @IsOptional() @IsString() aboutEn?: string;

  @ApiPropertyOptional({ description: 'Privacy policy in Arabic' })
  @IsOptional() @IsString() privacyPolicyAr?: string;

  @ApiPropertyOptional({ description: 'Privacy policy in English' })
  @IsOptional() @IsString() privacyPolicyEn?: string;

  @ApiPropertyOptional({ description: 'Terms & conditions in Arabic' })
  @IsOptional() @IsString() termsAr?: string;

  @ApiPropertyOptional({ description: 'Terms & conditions in English' })
  @IsOptional() @IsString() termsEn?: string;

  @ApiPropertyOptional({ description: 'Cancellation policy in Arabic' })
  @IsOptional() @IsString() cancellationPolicyAr?: string;

  @ApiPropertyOptional({ description: 'Cancellation policy in English' })
  @IsOptional() @IsString() cancellationPolicyEn?: string;

  @ApiPropertyOptional({ description: 'Default app language', example: 'ar' })
  @IsOptional() @IsString() defaultLanguage?: string;

  @ApiPropertyOptional({ description: 'IANA timezone identifier', example: 'Asia/Riyadh' })
  @IsOptional() @IsString() timezone?: string;

  @ApiPropertyOptional({ description: 'Week start day', example: 'sunday' })
  @IsOptional() @IsString() weekStartDay?: string;

  @ApiPropertyOptional({ description: 'Date format string', example: 'DD/MM/YYYY' })
  @IsOptional() @IsString() dateFormat?: string;

  @ApiPropertyOptional({ description: 'Time format string', example: '12h' })
  @IsOptional() @IsString() timeFormat?: string;

  @ApiPropertyOptional({ description: 'Show clinic logo in email header', example: true })
  @IsOptional() @IsBoolean() emailHeaderShowLogo?: boolean;

  @ApiPropertyOptional({ description: 'Show clinic name in email header', example: true })
  @IsOptional() @IsBoolean() emailHeaderShowName?: boolean;

  @ApiPropertyOptional({ description: 'Phone number shown in email footer', example: '+966500000000' })
  @IsOptional() @IsString() emailFooterPhone?: string;

  @ApiPropertyOptional({ description: 'Website URL shown in email footer', example: 'https://example.com' })
  @IsOptional() @IsString() emailFooterWebsite?: string;

  @ApiPropertyOptional({ description: 'Instagram handle for email footer', example: 'clinic_sa' })
  @IsOptional() @IsString() emailFooterInstagram?: string;

  @ApiPropertyOptional({ description: 'Twitter/X handle for email footer', example: 'clinic_sa' })
  @IsOptional() @IsString() emailFooterTwitter?: string;

  @ApiPropertyOptional({ description: 'Snapchat handle for email footer', example: 'clinic_sa' })
  @IsOptional() @IsString() emailFooterSnapchat?: string;

  @ApiPropertyOptional({ description: 'TikTok handle for email footer', example: 'clinic_sa' })
  @IsOptional() @IsString() emailFooterTiktok?: string;

  @ApiPropertyOptional({ description: 'LinkedIn URL for email footer', example: 'https://linkedin.com/company/clinic' })
  @IsOptional() @IsString() emailFooterLinkedin?: string;

  @ApiPropertyOptional({ description: 'YouTube channel URL for email footer', example: 'https://youtube.com/@clinic' })
  @IsOptional() @IsString() emailFooterYoutube?: string;

  @ApiPropertyOptional({ description: 'Default session duration in minutes (15–480)', example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) sessionDuration?: number;

  @ApiPropertyOptional({ description: 'Minutes before appointment to send reminder', example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) reminderBeforeMinutes?: number;

  @ApiPropertyOptional({ description: 'Booking flow order', enum: ['service_first', 'employee_first', 'both'], example: 'service_first' })
  @IsOptional() @IsIn(['service_first', 'employee_first', 'both']) bookingFlowOrder?: string;

  @ApiPropertyOptional({ description: 'Enable Moyasar online payment', example: true })
  @IsOptional() @IsBoolean() paymentMoyasarEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable pay-at-clinic option', example: true })
  @IsOptional() @IsBoolean() paymentAtClinicEnabled?: boolean;
}
