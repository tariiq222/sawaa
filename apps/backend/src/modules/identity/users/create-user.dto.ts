import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole, UserGender } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizePhone } from '../shared/normalize-phone.transform';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail() email!: string;

  @ApiProperty({ description: 'Initial password (min 8 characters)', example: 'P@ssw0rd123', format: 'password' })
  @IsString() @MinLength(8) password!: string;

  @ApiProperty({ description: 'Full display name', example: 'Sara Al-Harbi' })
  @IsString() name!: string;

  @ApiProperty({ description: 'System role', enum: UserRole, enumName: 'UserRole', example: UserRole.RECEPTIONIST })
  @IsEnum(UserRole) role!: UserRole;

  @ApiPropertyOptional({ description: 'Mobile phone number (any common format; normalized to E.164)', example: '+966501234567' })
  @IsOptional() @IsString() @NormalizePhone() phone?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: UserGender, enumName: 'UserGender', example: UserGender.FEMALE })
  @IsOptional() @IsEnum(UserGender) gender?: UserGender;

  @ApiPropertyOptional({ description: 'UUID of a custom role to assign', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() customRoleId?: string;
}
