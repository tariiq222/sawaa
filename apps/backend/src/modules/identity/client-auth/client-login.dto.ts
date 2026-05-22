import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClientLoginDto {
  @ApiProperty({ description: 'Client email address', example: 'client@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

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
