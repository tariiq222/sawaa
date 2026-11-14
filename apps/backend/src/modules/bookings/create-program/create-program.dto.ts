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
  @ApiProperty({ format: 'uuid', description: 'Owning department identifier', example: '77777777-7777-4777-8777-777777777777' })
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch where the program is offered', example: '88888888-8888-4888-8888-888888888888' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Arabic display name' })
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English display name' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic staff-facing description', example: 'برنامج لتنمية مهارات التواصل الأسري' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English staff-facing description', example: 'A program for family communication skills' })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ minimum: 1, description: 'Number of program days', example: 3 })
  @IsInt()
  @Min(1)
  daysCount!: number;

  @ApiProperty({ minimum: 1, description: 'Number of program hours per day', example: 2 })
  @IsInt()
  @Min(1)
  hoursPerDay!: number;

  @ApiProperty({ minimum: 1, default: 1, description: 'Minimum participants required for the program', example: 3 })
  @IsInt()
  @Min(1)
  minParticipants!: number;

  @ApiProperty({ minimum: 1, default: 30, description: 'Maximum number of enrolled participants', example: 12 })
  @IsInt()
  @Min(1)
  maxParticipants!: number;

  /** Whole halalas — the API converts SAR → halalas at the controller boundary. */
  @ApiProperty({ description: 'Price in integer halalas', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ default: 'SAR', description: 'Program price currency code', example: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: false, description: 'Whether the program accepts a deposit', example: true })
  @IsOptional()
  @IsBoolean()
  depositEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Deposit amount in integer halalas (must be <= price)',
    example: 30000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ default: false, description: 'Whether the program is published in the public catalog', example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Arabic public catalog description', example: 'تعرف على مهارات التواصل الأسري' })
  @IsOptional()
  @IsString()
  publicDescriptionAr?: string;

  @ApiPropertyOptional({ description: 'English public catalog description', example: 'Learn family communication skills' })
  @IsOptional()
  @IsString()
  publicDescriptionEn?: string;

  @ApiProperty({ type: [String], description: 'Supervising employee IDs' })
  @IsArray()
  @IsUUID('all', { each: true })
  supervisorIds!: string[];
}
