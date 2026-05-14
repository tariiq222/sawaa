import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactMessageDto {
  @ApiProperty({ description: 'Sender name', example: 'سارة أحمد' })
  @IsString() @MinLength(2) @MaxLength(200) name!: string;

  @ApiPropertyOptional({ description: 'Phone (required if no email)', example: '+966501234567' })
  @IsOptional() @IsString() @Matches(/^\+?[0-9\s-]{7,20}$/) phone?: string;

  @ApiPropertyOptional({ description: 'Email (required if no phone)', example: 'user@example.com' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ description: 'Subject', example: 'استفسار عن الحجز' })
  @IsOptional() @IsString() @MaxLength(200) subject?: string;

  @ApiProperty({ description: 'Message body', example: 'أرغب بمعرفة...' })
  @IsString() @MinLength(5) @MaxLength(5000) body!: string;

  @ApiPropertyOptional({ description: 'hCaptcha token (required in prod)', example: '10000000-aaaa-bbbb-cccc-000000000001' })
  @IsOptional() @IsString() captchaToken?: string;
}
