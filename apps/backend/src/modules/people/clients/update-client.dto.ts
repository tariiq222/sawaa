import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClientAccountType, ClientBloodType, ClientGender, ClientSource } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

// Saudi phone only: +966 then 5 then 8 digits (local number 5XXXXXXXX)
const PHONE_REGEX = /^\+9665\d{8}$/;

export class UpdateClientDto {
  @ApiPropertyOptional({ description: "Client's first name", example: 'Sara' })
  @IsOptional() @IsString() @MaxLength(255) firstName?: string;

  @ApiPropertyOptional({ description: "Client's middle name", example: 'Ali', nullable: true })
  @IsOptional() @IsString() @MaxLength(255) middleName?: string | null;

  @ApiPropertyOptional({ description: "Client's last name", example: 'Al-Harbi' })
  @IsOptional() @IsString() @MaxLength(255) lastName?: string;

  @ApiPropertyOptional({ description: 'Saudi mobile number (any common format; normalized to E.164)', example: '+966501234567', nullable: true })
  @IsOptional() @IsString() @NormalizePhone() @Matches(PHONE_REGEX, { message: 'phone must be a Saudi number +9665XXXXXXXX' }) phone?: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com', nullable: true })
  @IsOptional() @IsEmail() email?: string | null;

  @ApiPropertyOptional({ description: 'Client gender', enum: ClientGender, enumName: 'ClientGender', example: ClientGender.FEMALE, nullable: true })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender | null;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601)', example: '1990-06-15', nullable: true })
  @IsOptional() @IsDateString() dateOfBirth?: string | null;

  @ApiPropertyOptional({ description: 'Nationality', example: 'Saudi', nullable: true })
  @IsOptional() @IsString() @MaxLength(100) nationality?: string | null;

  @ApiPropertyOptional({ description: 'National ID or Iqama number', example: '1234567890', nullable: true })
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string | null;

  @ApiPropertyOptional({ description: 'Emergency contact name', example: 'Ahmad Al-Harbi', nullable: true })
  @IsOptional() @IsString() @MaxLength(255) emergencyName?: string | null;

  @ApiPropertyOptional({ description: 'Emergency contact Saudi mobile number', example: '+966501234567', nullable: true })
  @IsOptional() @IsString() @NormalizePhone() @Matches(PHONE_REGEX, { message: 'emergencyPhone must be a Saudi number +9665XXXXXXXX' }) emergencyPhone?: string | null;

  @ApiPropertyOptional({ description: 'Blood type', enum: ClientBloodType, enumName: 'ClientBloodType', example: ClientBloodType.A_POS, nullable: true })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientBloodType) bloodType?: ClientBloodType | null;

  @ApiPropertyOptional({ description: 'Known allergies', example: 'Penicillin', nullable: true })
  @IsOptional() @IsString() @MaxLength(1000) allergies?: string | null;

  @ApiPropertyOptional({ description: 'Chronic conditions', example: 'Type 2 Diabetes', nullable: true })
  @IsOptional() @IsString() @MaxLength(1000) chronicConditions?: string | null;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string | null;

  @ApiPropertyOptional({ description: 'Internal notes about the client', example: 'Prefers morning appointments', nullable: true })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;

  @ApiPropertyOptional({ description: 'Acquisition source', enum: ClientSource, enumName: 'ClientSource', example: ClientSource.REFERRAL })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;

  @ApiPropertyOptional({ description: 'Account type', enum: ClientAccountType, enumName: 'ClientAccountType', example: ClientAccountType.FULL })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientAccountType) accountType?: ClientAccountType;

  @ApiPropertyOptional({ description: 'Whether the client is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Preferred locale (ISO 639-1)', example: 'ar', nullable: true })
  @IsOptional() @IsString() @MaxLength(8) preferredLocale?: string | null;

  @ApiPropertyOptional({ description: 'Whether the client receives push notifications', example: true })
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
}
