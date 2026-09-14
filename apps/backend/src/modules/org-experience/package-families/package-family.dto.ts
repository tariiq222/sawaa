import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { GlobalDiscountDto, GroupedPackageGroupDto } from '../session-packages/grouped-package.dto';
import type { DiscriminatedGlobalDiscountDto } from '../session-packages/grouped-package.dto';

export class PackageFamilyOptionDto {
  @ApiPropertyOptional({ description: 'Existing grouped option UUID; omit to create a new option', format: 'uuid' })
  @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Arabic option name', example: '5 جلسات' })
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English option name', example: '5 sessions' })
  @IsOptional() @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Whether the option can be purchased', default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the option is shown publicly', default: false })
  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ description: 'Complete grouped session graph', type: [GroupedPackageGroupDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GroupedPackageGroupDto)
  groups!: GroupedPackageGroupDto[];

  @ApiProperty({ description: 'Option-wide discount', type: GlobalDiscountDto })
  @ValidateNested() @Type(() => GlobalDiscountDto)
  globalDiscount!: DiscriminatedGlobalDiscountDto;
}

export class CreatePackageFamilyDto {
  @ApiProperty({ description: 'Arabic family name', example: 'باقة الاستشارة' })
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English family name', example: 'Consultation pack' })
  @IsOptional() @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic family description' })
  @IsOptional() @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English family description' })
  @IsOptional() @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Catalog image URL' })
  @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Whether the family is active', default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the family is public', default: false })
  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Catalog ordering', default: 0 })
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @ApiProperty({ description: 'Complete option list', type: [PackageFamilyOptionDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PackageFamilyOptionDto)
  options!: PackageFamilyOptionDto[];
}

export class UpdatePackageFamilyDto extends CreatePackageFamilyDto {
  @IsOptional() @IsUUID()
  familyId?: string;
}
