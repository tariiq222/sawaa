import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SemanticSearchDto {
  @ApiProperty({ description: 'Natural language search query', example: 'What are the clinic opening hours?' })
  @IsString() @MinLength(1) query!: string;

  @ApiPropertyOptional({ description: 'Maximum number of results to return (1–50)', example: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(50) topK?: number;

  @ApiPropertyOptional({ description: 'Restrict search to a specific document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @IsOptional() @IsUUID() documentId?: string;
}

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}
