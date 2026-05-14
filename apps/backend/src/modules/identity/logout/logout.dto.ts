import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token to revoke. Browser clients omit this — the httpOnly ck_refresh cookie is used instead.',
    example: 'a1b2c3d4-...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
