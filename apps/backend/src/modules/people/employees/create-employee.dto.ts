import { ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeGender, EmploymentType } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Full display name', example: 'Dr. Khalid Al-Otaibi' })
  @IsString() @MaxLength(200) name!: string;

  @ApiPropertyOptional({ description: 'Phone number (any common format; normalized to E.164)', example: '+966501234567' })
  @IsOptional() @IsString() @NormalizePhone() @Matches(/^\+[1-9][0-9]{6,14}$/) phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: EmployeeGender, enumName: 'EmployeeGender', example: EmployeeGender.MALE })
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/khalid.jpg' })
  @IsOptional() @IsString() avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Short biography', example: 'Specialist in physiotherapy with 10 years of experience.' })
  @IsOptional() @IsString() bio?: string;

  @ApiPropertyOptional({ description: 'Employment type', enum: EmploymentType, enumName: 'EmploymentType', example: EmploymentType.FULL_TIME })
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Linked user account UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() userId?: string;

  @ApiPropertyOptional({ description: 'Branch UUIDs to assign', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) branchIds?: string[];

  @ApiPropertyOptional({ description: 'Service UUIDs to assign', example: ['00000000-0000-0000-0000-000000000000'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) serviceIds?: string[];
}
