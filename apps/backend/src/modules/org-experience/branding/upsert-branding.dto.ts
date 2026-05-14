import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const HOSTNAME_REGEX = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export class UpsertBrandingDto {
  @ApiProperty({ description: 'Organization name in Arabic', example: 'عيادة الرعاية' })
  @IsString() @MaxLength(200) organizationNameAr!: string;

  @ApiPropertyOptional({ description: 'Organization name in English', example: 'Deqah Clinic' })
  @IsOptional() @IsString() @MaxLength(200) organizationNameEn?: string;

  @ApiPropertyOptional({ description: 'Product tagline shown under the organization name', example: 'نحو رعاية أفضل' })
  @IsOptional() @IsString() @MaxLength(200) productTagline?: string;

  @ApiPropertyOptional({ description: 'Logo image URL', example: 'https://example.com/logo.png' })
  @IsOptional() @IsString() logoUrl?: string;

  @ApiPropertyOptional({ description: 'Favicon image URL', example: 'https://example.com/favicon.ico' })
  @IsOptional() @IsString() faviconUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color (hex)', example: '#354FD8' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorPrimary must be a hex color' }) colorPrimary?: string;

  @ApiPropertyOptional({ description: 'Lighter tint of the primary color (hex)', example: '#6B7FE3' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorPrimaryLight must be a hex color' }) colorPrimaryLight?: string;

  @ApiPropertyOptional({ description: 'Darker shade of the primary color (hex)', example: '#1E3AB8' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorPrimaryDark must be a hex color' }) colorPrimaryDark?: string;

  @ApiPropertyOptional({ description: 'Accent / highlight color (hex)', example: '#82CC17' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorAccent must be a hex color' }) colorAccent?: string;

  @ApiPropertyOptional({ description: 'Darker shade of the accent color (hex)', example: '#5A8F0F' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorAccentDark must be a hex color' }) colorAccentDark?: string;

  @ApiPropertyOptional({ description: 'Default background color (hex)', example: '#F8F9FF' })
  @IsOptional() @Matches(HEX_COLOR_REGEX, { message: 'colorBackground must be a hex color' }) colorBackground?: string;

  @ApiPropertyOptional({ description: 'Font family name', example: 'IBM Plex Sans Arabic' })
  @IsOptional() @IsString() @MaxLength(200) fontFamily?: string;

  @ApiPropertyOptional({ description: 'Font file or stylesheet URL', example: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic' })
  @IsOptional() @IsString() fontUrl?: string;

  @ApiPropertyOptional({ description: 'Custom CSS injected into the clinic app', example: ':root { --radius: 8px; }' })
  @IsOptional() @IsString() customCss?: string;

  @ApiPropertyOptional({ description: 'Public website domain (hostname)', example: 'clinic.example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_REGEX, { message: 'websiteDomain must be a valid hostname' })
  websiteDomain?: string | null;

  @ApiPropertyOptional({ description: 'Active website theme', enum: ['SAWAA', 'PREMIUM'] })
  @IsOptional()
  @IsEnum(['SAWAA', 'PREMIUM'])
  activeWebsiteTheme?: 'SAWAA' | 'PREMIUM';
}
