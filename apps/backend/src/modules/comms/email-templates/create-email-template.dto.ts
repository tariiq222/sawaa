import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Unique slug identifier for the template', example: 'booking-confirmed' })
  @IsString() @MinLength(2) @MaxLength(64) slug!: string;

  @ApiProperty({ description: 'Display name (free-form, any language)', example: 'تأكيد الحجز' })
  @IsString() @MinLength(1) @MaxLength(200) name!: string;

  @ApiProperty({ description: 'Email subject line (free-form, any language)', example: 'تم تأكيد حجزك' })
  @IsString() @MinLength(1) @MaxLength(300) subject!: string;

  @ApiProperty({ description: 'HTML body of the email (supports Handlebars variables)', example: '<p>Hello {{name}}</p>' })
  @IsString() htmlBody!: string;

  @ApiPropertyOptional({ description: 'Block tree (source of truth — when present, htmlBody is rendered from this)', type: 'array', items: { type: 'object' } })
  @IsOptional() blocks?: unknown[];
}
