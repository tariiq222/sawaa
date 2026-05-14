import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClientLoginDto {
  @ApiProperty({ description: 'Client email address', example: 'client@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({ description: 'Account password', example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password!: string;


}
