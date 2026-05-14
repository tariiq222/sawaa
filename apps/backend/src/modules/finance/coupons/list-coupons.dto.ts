import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListCouponsDto {
  @ApiPropertyOptional({ description: 'Search by coupon code or description', example: 'WELCOME' })
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ description: 'Filter by coupon status', enum: ['active', 'inactive', 'expired'], example: 'active' })
  @IsOptional() @IsIn(['active', 'inactive', 'expired']) status?: 'active' | 'inactive' | 'expired';

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page (max 100)', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
