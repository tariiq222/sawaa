import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeGender } from '@prisma/client';

export type OnboardingStep = 'profile' | 'branches' | 'services' | 'complete';

export class EmployeeOnboardingProfileDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'Dr. Khalid Al-Otaibi' })
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @ApiPropertyOptional({ description: 'Phone number (international format)', example: '+966501234567' })
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{9,15}$/) phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: EmployeeGender, enumName: 'EmployeeGender', example: EmployeeGender.MALE })
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;

  @ApiPropertyOptional({ description: 'Short biography', example: 'Specialist with 10 years of experience.' })
  @IsOptional() @IsString() bio?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/khalid.jpg' })
  @IsOptional() @IsString() avatarUrl?: string;
}

export class EmployeeOnboardingDto {
  @ApiProperty({ description: 'Onboarding step to complete', enum: ['profile', 'branches', 'services', 'complete'], example: 'profile' })
  @IsEnum(['profile', 'branches', 'services', 'complete'])
  step!: OnboardingStep;

  @ApiPropertyOptional({ description: 'Profile data (required when step = profile)', type: EmployeeOnboardingProfileDto })
  @IsOptional() @ValidateNested() @Type(() => EmployeeOnboardingProfileDto)
  profile?: EmployeeOnboardingProfileDto;

  @ApiPropertyOptional({ description: 'Branch UUIDs (required when step = branches)', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) branchIds?: string[];

  @ApiPropertyOptional({ description: 'Service UUIDs (required when step = services)', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) serviceIds?: string[];
}
