import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientGender } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

export class GuestClientInfoDto {
  @ApiProperty({ description: 'Client full name', example: 'أحمد محمد' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Phone number (any common format; normalized to E.164)', example: '+966501234567' })
  @IsString()
  @IsNotEmpty()
  @NormalizePhone()
  phone!: string;

  @ApiProperty({ description: 'Email address', example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ClientGender, description: 'Client gender' })
  @IsOptional()
  @IsEnum(ClientGender)
  gender?: ClientGender;

  @ApiPropertyOptional({ description: 'Additional notes for the booking', example: 'First visit' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGuestBookingDto {
  @ApiProperty({ description: 'Service ID', example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Employee ID', example: '00000000-0000-0000-0000-000000000002' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'Branch ID', example: '00000000-0000-0000-0000-000000000003' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Booking start time (ISO 8601)', example: '2026-04-20T09:00:00Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'Client information', type: GuestClientInfoDto })
  @IsNotEmpty()
  client!: GuestClientInfoDto;
}
