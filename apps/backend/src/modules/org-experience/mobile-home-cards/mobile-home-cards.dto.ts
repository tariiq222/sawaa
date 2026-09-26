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
  @ApiProperty({ maxLength: 100, example: 'مواعيد مرنة تناسب يومك' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  titleAr!: string;

  @ApiPropertyOptional({ type: String, maxLength: 100, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(100)
  titleEn?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionAr?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionEn?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional() @IsUUID()
  imageFileId?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltAr?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltEn?: string | null;

  @ApiPropertyOptional({ enum: MobileHomeCardDestination, nullable: true })
  @IsOptional() @IsEnum(MobileHomeCardDestination)
  destination?: MobileHomeCardDestination | null;
}

export class CreateMobileHomeCardDto extends MobileHomeCardContentDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647, default: 0 })
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(2147483647)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  isPublished?: boolean;
}

export class UpdateMobileHomeCardDto {
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  titleAr?: string;

  @ApiPropertyOptional({ type: String, maxLength: 100, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(100)
  titleEn?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionAr?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  descriptionEn?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional() @IsUUID()
  imageFileId?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltAr?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 240, nullable: true })
  @Transform(trimOrNull) @IsOptional() @IsString() @MaxLength(240)
  imageAltEn?: string | null;
  @ApiPropertyOptional({ enum: MobileHomeCardDestination, nullable: true })
  @IsOptional() @IsEnum(MobileHomeCardDestination)
  destination?: MobileHomeCardDestination | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647 })
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(2147483647)
  sortOrder?: number;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ReorderMobileHomeCardItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ReorderMobileHomeCardsDto {
  @ApiProperty({ type: [ReorderMobileHomeCardItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderMobileHomeCardItemDto)
  items!: ReorderMobileHomeCardItemDto[];
}
