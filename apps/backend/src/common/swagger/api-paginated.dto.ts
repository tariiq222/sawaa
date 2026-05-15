import { ApiProperty } from '@nestjs/swagger';

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

