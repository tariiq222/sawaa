import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeGender, EmploymentType } from '@prisma/client';

export class OnboardEmployeeDto {
  @ApiPropertyOptional({ description: 'Professional title', example: 'Dr.' })
  @IsOptional() @IsString() @MaxLength(100) title?: string;

  @ApiProperty({ description: 'Full name in English', example: 'Khalid Al-Otaibi' })
  @IsString() @MaxLength(200) nameEn!: string;

  @ApiProperty({ description: 'Full name in Arabic', example: 'خالد العتيبي' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiProperty({ description: 'Work email address', example: 'user@example.com' })
  @IsEmail() email!: string;

  @ApiPropertyOptional({ description: 'Phone number (international format)', example: '+966501234567' })
  @IsOptional() @IsString() @Matches(/^\+?[0-9\s-]{7,20}$/) phone?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: EmployeeGender, enumName: 'EmployeeGender' })
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;

  @ApiPropertyOptional({ description: 'Employment type', enum: EmploymentType, enumName: 'EmploymentType' })
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;

  @ApiProperty({ description: 'Specialty label in English', example: 'Physiotherapy' })
  @IsString() @MaxLength(200) specialty!: string;

  @ApiPropertyOptional({ description: 'Specialty label in Arabic', example: 'العلاج الطبيعي' })
  @IsOptional() @IsString() @MaxLength(200) specialtyAr?: string;

  @ApiPropertyOptional({ description: 'Short biography in English', example: 'Specialist with 10 years of experience.' })
  @IsOptional() @IsString() bio?: string;

  @ApiPropertyOptional({ description: 'Short biography in Arabic', example: 'متخصص بخبرة 10 سنوات.' })
  @IsOptional() @IsString() bioAr?: string;

  @ApiPropertyOptional({ description: 'Years of experience', example: 10 })
  @IsOptional() @IsInt() @Min(0) experience?: number;

  @ApiPropertyOptional({ description: 'Education details in English', example: 'King Saud University — BSc Physical Therapy' })
  @IsOptional() @IsString() education?: string;

  @ApiPropertyOptional({ description: 'Education details in Arabic', example: 'جامعة الملك سعود — بكالوريوس علاج طبيعي' })
  @IsOptional() @IsString() educationAr?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/khalid.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string | null;

  @ApiPropertyOptional({ description: 'Whether the employee is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
