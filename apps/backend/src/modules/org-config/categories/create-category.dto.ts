import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryBookingMode } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name in Arabic', example: 'طب الأسنان' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ description: 'Category name in English', example: 'Dentistry' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'UUID of the parent department', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ description: 'Display order (0-based, lower sorts first)', example: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Booking mode: DIRECT (category is the booking unit) or SERVICES (container for multiple services)',
    enum: CategoryBookingMode,
    example: CategoryBookingMode.SERVICES,
  })
  @IsOptional() @IsEnum(CategoryBookingMode) bookingMode?: CategoryBookingMode;

  @ApiPropertyOptional({ description: 'Category image URL', example: 'https://example.com/logo.png' })
  @IsOptional() @IsString() imageUrl?: string;

  @ApiPropertyOptional({ example: 'scissors-01' })
  @IsOptional() @IsString() @MaxLength(50) iconName?: string;

  @ApiPropertyOptional({ example: '#F0F4FF' })
  @IsOptional() @IsString() @MaxLength(20) iconBgColor?: string;
}
