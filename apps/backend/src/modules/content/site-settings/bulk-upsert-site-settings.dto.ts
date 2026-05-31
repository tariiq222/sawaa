import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Upper bound on a single text value field to prevent unbounded payloads. */
const MAX_VALUE_LENGTH = 10_000;
/** Upper bound on the number of entries accepted in one bulk-upsert call. */
const MAX_ENTRIES = 100;

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
  @MaxLength(MAX_VALUE_LENGTH)
  valueText?: string | null;

  @ApiPropertyOptional({ description: 'Arabic text value' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VALUE_LENGTH)
  valueAr?: string | null;

  @ApiPropertyOptional({ description: 'English text value' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VALUE_LENGTH)
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
  @MaxLength(MAX_VALUE_LENGTH)
  valueMedia?: string | null;
}

export class BulkUpsertSiteSettingsDto {
  @ApiProperty({
    description: 'List of settings to upsert',
    type: [SiteSettingEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => SiteSettingEntryDto)
  entries!: SiteSettingEntryDto[];
}
