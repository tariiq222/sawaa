import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryBookingMode } from '@prisma/client';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name in Arabic', example: 'طب الأسنان' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Category name in English', example: 'Dentistry' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'UUID of the parent department, or null to unlink', example: '00000000-0000-0000-0000-000000000000', nullable: true })
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() departmentId?: string | null;

  @ApiPropertyOptional({ description: 'Display order (0-based)', example: 1 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the category is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

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
