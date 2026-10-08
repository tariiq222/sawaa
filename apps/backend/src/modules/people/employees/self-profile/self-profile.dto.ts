import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateSelfProfileDto {
  @ApiPropertyOptional({ description: 'Public biography in Arabic', maxLength: 5000, example: 'أعمل في الإرشاد الأسري.' })
  @IsOptional() @IsString() @MaxLength(5000) bioAr?: string;
  @ApiPropertyOptional({ description: 'Public biography in English', maxLength: 5000, example: 'Family counselor.' })
  @IsOptional() @IsString() @MaxLength(5000) bioEn?: string;
  @ApiPropertyOptional({ description: 'Years of experience; null clears the value', type: Number, nullable: true, example: 8 })
  @IsOptional() @IsInt() @Min(0) @Max(80) experience?: number | null;
  @ApiPropertyOptional({ description: 'Spoken languages', type: [String], example: ['العربية', 'English'] })
  @Transform(({ value }: { value: unknown }) => Array.isArray(value) ? value.map(v => typeof v === 'string' ? v.trim() : v) : value)
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(60, { each: true }) languages?: string[];
}

export class SelfProfileResponseDto {
  @ApiProperty({ example: '00000000-0000-4000-a000-000000000001' }) id!: string;
  @ApiProperty({ example: 'Nora' }) name!: string;
  @ApiProperty({ type: String, nullable: true, example: 'https://cdn.example.com/photo.jpg' }) avatarUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'نبذة' }) bioAr!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Biography' }) bioEn!: string | null;
  @ApiProperty({ type: Number, nullable: true, example: 8 }) experience!: number | null;
  @ApiProperty({ type: [String], example: ['العربية'] }) languages!: string[];
  @ApiProperty({ example: 'nora@example.com' }) email!: string;
  @ApiProperty({ type: String, nullable: true, example: '+966501234567' }) phone!: string | null;
}
