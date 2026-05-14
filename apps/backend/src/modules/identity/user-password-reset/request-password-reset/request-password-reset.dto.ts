import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Staff email address', example: 'admin@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;


}
