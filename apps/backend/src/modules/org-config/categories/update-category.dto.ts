import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryBookingMode } from '@prisma/client';
import { CATEGORY_KINDS, type CategoryKindInput } from './create-category.dto';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name in Arabic', example: 'طب الأسنان' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Category name in English', type: String, example: 'Dentistry', nullable: true })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string | null;

  @ApiPropertyOptional({ description: 'UUID of the parent department, or null to unlink', type: String, example: '00000000-0000-0000-0000-000000000000', nullable: true })
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

  @ApiPropertyOptional({ description: 'Category kind, independent of its department or name', enum: CATEGORY_KINDS, example: 'CLINIC' })
  @IsOptional() @IsEnum(CATEGORY_KINDS) kind?: CategoryKindInput;

  @ApiPropertyOptional({ description: 'Category image URL or stored object key', type: String, example: 'https://example.com/logo.png', nullable: true })
  @IsOptional() @IsString() imageUrl?: string | null;

  @ApiPropertyOptional({ type: String, example: 'scissors-01', nullable: true })
  @IsOptional() @IsString() @MaxLength(50) iconName?: string | null;

  @ApiPropertyOptional({ type: String, example: '#F0F4FF', nullable: true })
  @IsOptional() @IsString() @MaxLength(20) iconBgColor?: string | null;
}
