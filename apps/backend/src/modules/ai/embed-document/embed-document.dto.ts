import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmbedDocumentDto {
  @ApiProperty({ description: 'Document title', example: 'Clinic Services Overview' })
  @IsString() @MinLength(1) title!: string;

  @ApiProperty({ description: 'Full text content to embed', example: 'We offer dental, physiotherapy, and general medicine services...' })
  @IsString() @MinLength(1) content!: string;

  @ApiProperty({ description: 'Origin of the document content', enum: ['manual', 'url', 'file'], example: 'manual' })
  @IsIn(['manual', 'url', 'file']) sourceType!: 'manual' | 'url' | 'file';

  @ApiPropertyOptional({ description: 'URL or file path that the content was sourced from', example: 'https://example.com/services' })
  @IsOptional() @IsString() sourceRef?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata attached to the document', example: { language: 'ar' } })
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
