import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProgramDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Arabic display name' })
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English display name' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  daysCount!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  hoursPerDay!: number;

  @ApiProperty({ minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  minParticipants!: number;

  @ApiProperty({ minimum: 1, default: 30 })
  @IsInt()
  @Min(1)
  maxParticipants!: number;

  /** Whole halalas — the API converts SAR → halalas at the controller boundary. */
  @ApiProperty({ description: 'Price in integer halalas', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  depositEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Deposit amount in integer halalas (must be <= price)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicDescriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicDescriptionEn?: string;

  @ApiProperty({ type: [String], description: 'Supervising employee IDs' })
  @IsArray()
  @IsUUID('all', { each: true })
  supervisorIds!: string[];
}
