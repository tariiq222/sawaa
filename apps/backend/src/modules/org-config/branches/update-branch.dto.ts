import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBranchDto {
  @ApiPropertyOptional({ description: 'Branch name in Arabic', example: 'فرع الرياض' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Branch name in English', example: 'Riyadh Branch' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Branch phone number', example: '+966112345678' })
  @IsOptional() @IsString() @MaxLength(30) phone?: string;

  @ApiPropertyOptional({ description: 'Branch address in Arabic', example: 'شارع الملك فهد، الرياض' })
  @IsOptional() @IsString() @MaxLength(500) addressAr?: string;

  @ApiPropertyOptional({ description: 'Branch address in English', example: 'King Fahd Road, Riyadh' })
  @IsOptional() @IsString() @MaxLength(500) addressEn?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Riyadh' })
  @IsOptional() @IsString() @MaxLength(100) city?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code', example: 'SA' })
  @IsOptional() @IsString() @MaxLength(2) country?: string;

  @ApiPropertyOptional({ description: 'GPS latitude', example: 24.7136 })
  @IsOptional() @IsLatitude() latitude?: number;

  @ApiPropertyOptional({ description: 'GPS longitude', example: 46.6753 })
  @IsOptional() @IsLongitude() longitude?: number;

  @ApiPropertyOptional({ description: 'Whether this branch is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether this is the main branch', example: false })
  @IsOptional() @IsBoolean() isMain?: boolean;

  @ApiPropertyOptional({ description: 'IANA timezone identifier', example: 'Asia/Riyadh' })
  @IsOptional() @IsString() timezone?: string;
}
