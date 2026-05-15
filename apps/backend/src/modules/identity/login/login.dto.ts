import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Account password (min 8 characters)', example: 'P@ssw0rd123', format: 'password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ description: 'Remember me (extends refresh token cookie lifetime)', required: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
