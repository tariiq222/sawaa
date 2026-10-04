import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewLoginDto {
  @ApiProperty({ description: 'Dedicated synthetic review account email', example: 'apple@review.sawaa.invalid' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ description: 'Review account password', example: 'AccountPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
