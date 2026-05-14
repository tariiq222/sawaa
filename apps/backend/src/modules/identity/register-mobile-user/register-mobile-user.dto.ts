import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizePhone } from '../shared/normalize-phone.transform';

export class RegisterMobileUserDto {
  @ApiProperty({ description: 'First name', example: 'سارة' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'الأحمد' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ description: 'Phone (any common Saudi-flavoured format; normalized to E.164)', example: '+966501234567' })
  @IsString()
  @NormalizePhone()
  phone!: string;

  @ApiProperty({ description: 'Email', example: 'sara@example.com' })
  @IsEmail()
  email!: string;
}
