import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SAUDI_PHONE_REGEX, SAUDI_PHONE_ERROR_AR } from '@sawaa/shared/validators/phone';
import { NormalizePhone } from '../shared/normalize-phone.transform';

/**
 * Exactly one of `email` / `phone` must be provided. The "exactly one"
 * invariant is enforced in ClientLoginHandler (a BadRequestException before
 * any lookup) so the rule lives in one place and stays trivially testable.
 */
export class ClientLoginDto {
  @ApiPropertyOptional({
    description: 'Client email address (provide either email or phone, not both)',
    example: 'client@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiPropertyOptional({
    description:
      'Saudi mobile number (any common format; normalized to E.164). Provide either email or phone, not both.',
    example: '+966501234567',
  })
  @IsOptional()
  @IsString()
  @NormalizePhone()
  @Matches(SAUDI_PHONE_REGEX, { message: SAUDI_PHONE_ERROR_AR })
  phone?: string;

  // SECURITY (P1): cap password length. bcrypt's own input limit is 72 bytes
  // (truncates silently), but unconstrained input forces a full bcrypt hash
  // of huge payloads — a cheap DoS vector. 200 is generous for any real
  // password manager.
  @ApiProperty({ description: 'Account password', example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
