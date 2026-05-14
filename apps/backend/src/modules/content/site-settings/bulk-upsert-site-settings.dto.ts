import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SiteSettingEntryDto {
  @ApiProperty({
    description: 'Setting key (dotted path, e.g. "home.hero.title.ar")',
    example: 'home.hero.title.ar',
  })
  @IsString()
  @MaxLength(200)
  key!: string;

  @ApiPropertyOptional({ description: 'Plain text value (lang-neutral)' })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @ApiPropertyOptional({ description: 'Arabic text value' })
  @IsOptional()
  @IsString()
  valueAr?: string | null;

  @ApiPropertyOptional({ description: 'English text value' })
  @IsOptional()
  @IsString()
  valueEn?: string | null;

  @ApiPropertyOptional({
    description: 'Structured JSON value (for lists, nested data)',
  })
  @IsOptional()
  valueJson?: unknown;

  @ApiPropertyOptional({
    description: 'Media URL (served from MinIO or external)',
  })
  @IsOptional()
  @IsString()
  valueMedia?: string | null;
}

export class BulkUpsertSiteSettingsDto {
  @ApiProperty({
    description: 'List of settings to upsert',
    type: [SiteSettingEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SiteSettingEntryDto)
  entries!: SiteSettingEntryDto[];
}
