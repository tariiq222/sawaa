import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Client refresh token', example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Client refresh token to revoke', example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
