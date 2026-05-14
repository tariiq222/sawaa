import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Staff email address', example: 'admin@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hCaptchaToken?: string;
}
