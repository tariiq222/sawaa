import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientAccountType, ClientBloodType, ClientGender, ClientSource } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

// Saudi phone only: +966 then 5 then 8 digits (local number 5XXXXXXXX)
const PHONE_REGEX = /^\+9665\d{8}$/;

export class CreateClientDto {
  @ApiProperty({ description: "Client's first name", example: 'Sara' })
  @IsString() @IsNotEmpty() @MaxLength(255) firstName!: string;

  @ApiPropertyOptional({ description: "Client's middle name", example: 'Ali' })
  @IsOptional() @IsString() @MaxLength(255) middleName?: string;

  @ApiProperty({ description: "Client's last name", example: 'Al-Harbi' })
  @IsString() @IsNotEmpty() @MaxLength(255) lastName!: string;

  @ApiProperty({ description: 'Saudi mobile number (any common format; normalized to E.164)', example: '+966501234567' })
  @IsString() @NormalizePhone() @Matches(PHONE_REGEX, { message: 'phone must be a Saudi number +9665XXXXXXXX' }) phone!: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ description: 'Client gender', enum: ClientGender, enumName: 'ClientGender', example: ClientGender.FEMALE })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601)', example: '1990-06-15' })
  @IsOptional() @IsDateString() dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Nationality', example: 'Saudi' })
  @IsOptional() @IsString() @MaxLength(100) nationality?: string;

  @ApiPropertyOptional({ description: 'National ID or Iqama number', example: '1234567890' })
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string;

  @ApiPropertyOptional({ description: 'Emergency contact name', example: 'Ahmad Al-Harbi' })
  @IsOptional() @IsString() @MaxLength(255) emergencyName?: string;

  @ApiPropertyOptional({ description: 'Emergency contact Saudi mobile number', example: '+966501234567' })
  @IsOptional() @IsString() @NormalizePhone() @Matches(PHONE_REGEX, { message: 'emergencyPhone must be a Saudi number +9665XXXXXXXX' }) emergencyPhone?: string;

  @ApiPropertyOptional({ description: 'Blood type', enum: ClientBloodType, enumName: 'ClientBloodType', example: ClientBloodType.A_POS })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientBloodType) bloodType?: ClientBloodType;

  @ApiPropertyOptional({ description: 'Known allergies', example: 'Penicillin' })
  @IsOptional() @IsString() @MaxLength(1000) allergies?: string;

  @ApiPropertyOptional({ description: 'Chronic conditions', example: 'Type 2 Diabetes' })
  @IsOptional() @IsString() @MaxLength(1000) chronicConditions?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg' })
  @IsOptional() @IsString() avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Internal notes about the client', example: 'Prefers morning appointments' })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ description: 'Acquisition source', enum: ClientSource, enumName: 'ClientSource', example: ClientSource.REFERRAL })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;

  @ApiPropertyOptional({ description: 'Account type', enum: ClientAccountType, enumName: 'ClientAccountType', example: ClientAccountType.FULL })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientAccountType) accountType?: ClientAccountType;

  @ApiPropertyOptional({ description: 'Whether the client is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Linked user account UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() userId?: string;
}
