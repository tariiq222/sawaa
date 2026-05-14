import { IsEmail, IsObject, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email address', example: 'user@example.com' })
  @IsEmail() to!: string;

  @ApiProperty({ description: 'Slug of the email template to use', example: 'booking-confirmed' })
  @IsString() @MinLength(1) templateSlug!: string;

  @ApiProperty({ description: 'Template variable values', example: { name: 'Fatima', date: '2026-04-17' } })
  @IsObject() vars!: Record<string, string>;
}
