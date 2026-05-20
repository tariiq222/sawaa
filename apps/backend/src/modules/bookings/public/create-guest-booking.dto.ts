import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType, ClientGender, DeliveryType } from '@prisma/client';
import { NormalizePhone } from '../../identity/shared/normalize-phone.transform';

const mapBookingType = (v: unknown) => {
  if (typeof v !== 'string' || !v) return v;
  const lower = v.toLowerCase();
  if (lower === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

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

  @ApiPropertyOptional({ description: 'Delivery channel (IN_PERSON or ONLINE)', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', example: '00000000-0000-0000-0000-000000000004' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Booking type (legacy — prefer deliveryType)', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @Transform(({ value }) => mapBookingType(value)) @IsString() bookingType?: BookingType | 'ONLINE';

  @ApiProperty({ description: 'Client information', type: GuestClientInfoDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GuestClientInfoDto)
  client!: GuestClientInfoDto;
}
