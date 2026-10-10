import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeGender, EmploymentType } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Professional title (e.g. Dr.)', example: 'Dr.' })
  @IsOptional() @IsString() @MaxLength(100) title?: string | null;

  @ApiPropertyOptional({ description: 'Full name in English', example: 'Khalid Al-Otaibi' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Full name in Arabic', example: 'خالد العتيبي' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @Transform(trimLower) @IsEmail() email?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Phone number (any common format; normalized to E.164)', example: '+966501234567' })
  @IsOptional() @IsString() @NormalizePhone() @Matches(/^\+[1-9][0-9]{6,14}$/) phone?: string | null;

  @ApiPropertyOptional({ description: 'Gender', enum: EmployeeGender, enumName: 'EmployeeGender', example: EmployeeGender.MALE })
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;

  @ApiPropertyOptional({ description: 'Employment type', enum: EmploymentType, enumName: 'EmploymentType', example: EmploymentType.FULL_TIME })
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Specialty label in English', example: 'Physiotherapy' })
  @IsOptional() @IsString() @MaxLength(200) specialty?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Specialty label in Arabic', example: 'العلاج الطبيعي' })
  @IsOptional() @IsString() @MaxLength(200) specialtyAr?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Short biography in English', example: 'Specialist with 10 years of experience.' })
  @IsOptional() @IsString() bio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Short biography in Arabic', example: 'متخصص بخبرة 10 سنوات.' })
  @IsOptional() @IsString() bioAr?: string | null;

  @ApiPropertyOptional({ description: 'Years of experience', example: 10 })
  @IsOptional() @IsInt() @Min(0) experience?: number;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Education details in English', example: 'King Saud University — BSc Physical Therapy' })
  @IsOptional() @IsString() education?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Education details in Arabic', example: 'جامعة الملك سعود — بكالوريوس علاج طبيعي' })
  @IsOptional() @IsString() educationAr?: string | null;

  @ApiPropertyOptional({ description: 'Whether the employee is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/khalid.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Public slug (unique, URL-safe)', example: 'dr-khalid' })
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^[a-z0-9-]+$/i, { message: 'slug must be alphanumeric with hyphens' })
  slug?: string | null;

  @ApiPropertyOptional({ description: 'Whether the employee appears in the public directory', example: true })
  @IsOptional() @IsBoolean() isPublic?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Public biography (Arabic)' })
  @IsOptional() @IsString() @MaxLength(5000) publicBioAr?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Public biography (English)' })
  @IsOptional() @IsString() @MaxLength(5000) publicBioEn?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Public profile image URL' })
  @IsOptional() @IsUrl() publicImageUrl?: string | null;
}
