import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MobileHomeCardDestination } from '@prisma/client';
import {
  IsArray, IsBoolean, IsEnum, IsISO8601, IsInt, IsNotEmpty, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() || null) : value;

export class MobileHomeCardContentDto {
  @ApiProperty({ description: 'Card title in Arabic.', maxLength: 100, example: 'مواعيد مرنة تناسب يومك' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  titleAr!: string;

  @ApiPropertyOptional({ description: 'Card title in English.', type: String, maxLength: 100, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(100)
  titleEn?: string | null;

  @ApiPropertyOptional({ description: 'Card description in Arabic.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionAr?: string | null;

  @ApiPropertyOptional({ description: 'Card description in English.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionEn?: string | null;

  @ApiPropertyOptional({ description: 'Identifier of the uploaded card image.', type: String, format: 'uuid', nullable: true })
  @IsOptional() @IsUUID()
  imageFileId?: string | null;

  @ApiPropertyOptional({ description: 'Alternative text for the card image in Arabic.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltAr?: string | null;

  @ApiPropertyOptional({ description: 'Alternative text for the card image in English.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltEn?: string | null;

  @ApiPropertyOptional({ description: 'In-app destination opened when the card is selected.', enum: MobileHomeCardDestination, nullable: true })
  @IsOptional() @IsEnum(MobileHomeCardDestination)
  destination?: MobileHomeCardDestination | null;
}

export class CreateMobileHomeCardDto extends MobileHomeCardContentDto {
  @ApiPropertyOptional({ description: 'Card display order; lower values appear first.', minimum: 0, maximum: 2147483647, default: 0 })
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(2147483647)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the card is published for mobile clients.', default: false })
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  isPublished?: boolean;
}

export class UpdateMobileHomeCardDto {
  @ApiPropertyOptional({ description: 'Card title in Arabic.', type: String, maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  titleAr?: string;

  @ApiPropertyOptional({ description: 'Card title in English.', type: String, maxLength: 100, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(100)
  titleEn?: string | null;
  @ApiPropertyOptional({ description: 'Card description in Arabic.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionAr?: string | null;
  @ApiPropertyOptional({ description: 'Card description in English.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionEn?: string | null;
  @ApiPropertyOptional({ description: 'Identifier of the uploaded card image.', type: String, format: 'uuid', nullable: true })
  @IsOptional() @IsUUID()
  imageFileId?: string | null;
  @ApiPropertyOptional({ description: 'Alternative text for the card image in Arabic.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltAr?: string | null;
  @ApiPropertyOptional({ description: 'Alternative text for the card image in English.', type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltEn?: string | null;
  @ApiPropertyOptional({ description: 'In-app destination opened when the card is selected.', enum: MobileHomeCardDestination, nullable: true })
  @IsOptional() @IsEnum(MobileHomeCardDestination)
  destination?: MobileHomeCardDestination | null;
  @ApiPropertyOptional({ description: 'Card display order; lower values appear first.', minimum: 0, maximum: 2147483647 })
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(2147483647)
  sortOrder?: number;
  @ApiPropertyOptional({ description: 'Whether the card is published for mobile clients.' })
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ description: 'Last known update timestamp used to detect concurrent changes.', format: 'date-time' })
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ReorderMobileHomeCardItemDto {
  @ApiProperty({ description: 'Unique mobile home card identifier.', format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Last known update timestamp used to detect concurrent changes.', format: 'date-time' })
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ReorderMobileHomeCardsDto {
  @ApiProperty({ description: 'Cards in their requested display order, with last known update timestamps.', type: [ReorderMobileHomeCardItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderMobileHomeCardItemDto)
  items!: ReorderMobileHomeCardItemDto[];
}
