import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClientGender, ClientSource } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class ListClientsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or phone', example: 'Sara' })
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional() @Transform(toBoolean, { toClassOnly: true }) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by gender', enum: ClientGender, enumName: 'ClientGender', example: ClientGender.FEMALE })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender;

  @ApiPropertyOptional({ description: 'Filter by acquisition source', enum: ClientSource, enumName: 'ClientSource', example: ClientSource.REFERRAL })
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;
}
