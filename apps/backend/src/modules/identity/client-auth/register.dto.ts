import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiPropertyOptional({ description: 'Full name (required if creating new account)', example: 'أحمد محمد' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  // SECURITY (P1): cap password length — see ClientLoginDto for rationale.
  @ApiProperty({ description: 'Password (min 8 chars, at least 1 upper, 1 digit)', example: 'SecurePass123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 digit' })
  password!: string;
}
