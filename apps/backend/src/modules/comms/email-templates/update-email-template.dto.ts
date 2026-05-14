import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Display name (free-form, any language)', example: 'تأكيد الحجز' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;

  @ApiPropertyOptional({ description: 'Email subject line (free-form, any language)', example: 'تم تأكيد حجزك' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) subject?: string;

  @ApiPropertyOptional({ description: 'HTML body of the email (supports Handlebars variables)', example: '<p>Hello {{name}}</p>' })
  @IsOptional() @IsString() htmlBody?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Block tree (source of truth — when present, htmlBody is rendered from this)', type: 'array', items: { type: 'object' } })
  @IsOptional() blocks?: unknown[];
}
