import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Template variable values for the preview render',
    example: { name: 'Fatima', date: '2026-04-17' },
  })
  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
