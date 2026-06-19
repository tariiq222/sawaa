import { DeliveryType } from '@prisma/client';
import { IsUUID, IsString, IsDateString, IsInt, IsEnum, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupSessionDto {
  @ApiProperty({ description: 'Branch where session takes place', example: '00000000-...' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Employee leading the session', example: '00000000-...' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service linked to this session', example: '00000000-...' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'Session title', example: 'Family Communication Workshop' })
  @IsString() title!: string;

  @ApiProperty({ description: 'ISO 8601 start datetime', example: '2026-07-01T10:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiProperty({ description: 'Duration in minutes', example: 90 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiProperty({ description: 'Maximum number of attendees', example: 20 })
  @IsInt() @Min(1) maxCapacity!: number;

  @ApiProperty({ description: 'Price in integer halalas', example: 30000 })
  @IsInt() @Min(0) price!: number;

  @ApiProperty({ description: 'Delivery channel', enum: DeliveryType, enumName: 'DeliveryType', example: DeliveryType.IN_PERSON })
  @IsEnum(DeliveryType) deliveryType!: DeliveryType;

  @ApiPropertyOptional({ description: 'Arabic description', example: 'وصف الجلسة' })
  @IsOptional() @IsString() descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description', example: 'Session description' })
  @IsOptional() @IsString() descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Make session visible on public website', example: false })
  @IsOptional() @IsBoolean() isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Public Arabic description', example: 'وصف عام' })
  @IsOptional() @IsString() publicDescriptionAr?: string;

  @ApiPropertyOptional({ description: 'Public English description', example: 'Public description' })
  @IsOptional() @IsString() publicDescriptionEn?: string;
}
