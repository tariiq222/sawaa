import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupProgramDto {
  @ApiProperty({ description: 'Department ID this program belongs to', example: '00000000-0000-0000-0000-000000000001' })
  @IsString() @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ description: 'Arabic name', example: 'برنامج دعم الأسرة' })
  @IsString() @IsNotEmpty()
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English name', example: 'Family Support Program' })
  @IsOptional() @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic description', example: 'وصف البرنامج' })
  @IsOptional() @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description', example: 'Program description' })
  @IsOptional() @IsString()
  descriptionEn?: string;

  @ApiProperty({ description: 'Minimum participants to activate a session', example: 3 })
  @IsInt() @Min(1)
  minParticipants!: number;

  @ApiProperty({ description: 'Maximum participants per session', example: 20 })
  @IsInt() @Min(1) @Max(500)
  maxParticipants!: number;

  @ApiProperty({ description: 'Default session price in integer halalas (0 = free)', example: 5000 })
  @IsInt() @Min(0)
  defaultPrice!: number;
}
