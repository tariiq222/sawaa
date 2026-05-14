import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: 'Total matching records' })
  total!: number;

  @ApiProperty({ example: 1, description: '1-based page number' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Records per page' })
  pageSize!: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages!: number;
}

/**
 * Generic paginated response envelope. Use via
 * `ApiPaginatedResponse(ItemDto)` from the decorator module — do not
 * extend this class directly.
 */
export class PaginatedDto<T> {
  data!: T[];
  meta!: PaginationMetaDto;
}

export type PaginatedCtor<T> = Type<PaginatedDto<T>>;
