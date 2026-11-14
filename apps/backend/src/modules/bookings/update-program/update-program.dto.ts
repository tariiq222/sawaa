import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Edit payload for an existing program. All fields are optional so the
 * dashboard edit form can submit a partial change, but the dashboard
 * form currently submits the full shape — both flows are accepted.
 *
 * Fields mirror `CreateProgramDto` deliberately so the edit UI reuses
 * the existing form values without translation.
 */
export class UpdateProgramDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Owning department identifier', example: '77777777-7777-4777-8777-777777777777' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Branch where the program is offered', example: '88888888-8888-4888-8888-888888888888' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Arabic display name' })
  @IsOptional()
  @IsString()
  nameAr?: string;

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

  @ApiPropertyOptional({ minimum: 1, description: 'Number of program days', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  daysCount?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Number of program hours per day', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  hoursPerDay?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Minimum participants required for the program', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minParticipants?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Maximum number of enrolled participants', example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Price in integer halalas', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Program price currency code', example: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether the program accepts a deposit', example: true })
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

  @ApiPropertyOptional({ description: 'Whether the program is published in the public catalog', example: true })
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

  @ApiPropertyOptional({ type: [String], description: 'Supervising employee identifiers; replaces the whole supervisor set', example: ['33333333-3333-4333-8333-333333333333'] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  supervisorIds?: string[];
}