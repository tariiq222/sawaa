// email-provider — owner-scoped DTO for writing email provider config.

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SmtpCredentialsDto {
  @ApiProperty({ description: 'SMTP host', example: 'smtp.gmail.com' })
  @IsString()
  @MaxLength(253)
  host!: string;

  @ApiProperty({ description: 'SMTP port', example: 587 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiProperty({ description: 'SMTP username / email', example: 'clinic@example.com' })
  @IsString()
  @MaxLength(320)
  user!: string;

  @ApiProperty({ description: 'SMTP password or app password' })
  @IsString()
  @MaxLength(500)
  pass!: string;

  @ApiPropertyOptional({ description: 'Use TLS (true for port 465)', example: false })
  @IsOptional()
  secure?: boolean;
}

export class ResendCredentialsDto {
  @ApiProperty({ description: 'Resend API key', example: 're_...' })
  @IsString()
  @MaxLength(500)
  apiKey!: string;
}

export class SendGridCredentialsDto {
  @ApiProperty({ description: 'SendGrid API key', example: 'SG...' })
  @IsString()
  @MaxLength(500)
  apiKey!: string;
}

export class MailchimpCredentialsDto {
  @ApiProperty({ description: 'Mailchimp Transactional (Mandrill) API key' })
  @IsString()
  @MaxLength(500)
  apiKey!: string;
}

export class UpsertOrgEmailConfigDto {
  @ApiProperty({ enum: ['NONE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILCHIMP'] })
  @IsEnum(['NONE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILCHIMP'])
  provider!: 'NONE' | 'SMTP' | 'RESEND' | 'SENDGRID' | 'MAILCHIMP';

  @ApiPropertyOptional({ description: 'Sender display name', example: 'عيادة الأمل' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  senderName?: string;

  @ApiPropertyOptional({ description: 'Sender email address', example: 'noreply@clinic.com' })
  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @ApiPropertyOptional({ type: SmtpCredentialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpCredentialsDto)
  smtp?: SmtpCredentialsDto;

  @ApiPropertyOptional({ type: ResendCredentialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResendCredentialsDto)
  resend?: ResendCredentialsDto;

  @ApiPropertyOptional({ type: SendGridCredentialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SendGridCredentialsDto)
  sendgrid?: SendGridCredentialsDto;

  @ApiPropertyOptional({ type: MailchimpCredentialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MailchimpCredentialsDto)
  mailchimp?: MailchimpCredentialsDto;
}
