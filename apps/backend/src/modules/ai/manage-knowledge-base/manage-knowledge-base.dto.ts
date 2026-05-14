import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListDocumentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by document status', enum: DocumentStatus, example: 'ACTIVE' })
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Document title', example: 'Clinic FAQ' })
  @IsOptional() @IsString() @MaxLength(500) title?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata', example: { source: 'admin' } })
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
