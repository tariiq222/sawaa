import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Client refresh token (optional when sent as httpOnly cookie)', example: 'a1b2c3d4-...', required: false })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Client refresh token to revoke (optional when sent as httpOnly cookie)', example: 'a1b2c3d4-...', required: false })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
