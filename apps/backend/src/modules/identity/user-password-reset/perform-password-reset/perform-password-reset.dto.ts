import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PerformPasswordResetDto {
  @ApiProperty({ description: 'Reset token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (≥8 chars)', example: 'newSecure123' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'newPassword must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'newPassword must contain at least one digit' })
  newPassword!: string;
}
