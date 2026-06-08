import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiscountReasonDto {
  @ApiProperty({ description: 'Reason label in Arabic', example: 'خصم من المعالج' })
  @IsString() @MinLength(1) @MaxLength(120)
  labelAr!: string;

  @ApiPropertyOptional({ description: 'Reason label in English', example: 'Therapist discount' })
  @IsOptional() @IsString() @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional({ description: 'Whether the reason is selectable', example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order (ascending)', example: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateDiscountReasonDto {
  @ApiPropertyOptional({ description: 'Reason label in Arabic', example: 'خصم خاص' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  labelAr?: string;

  @ApiPropertyOptional({ description: 'Reason label in English', example: 'Special discount' })
  @IsOptional() @IsString() @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional({ description: 'Whether the reason is selectable', example: false })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order (ascending)', example: 1 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}
