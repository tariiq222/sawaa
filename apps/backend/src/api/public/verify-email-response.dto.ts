import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shape for `GET /public/verify-email`.
 *
 * Documentation only: `VerifyEmailHandler` consumes the single-use token and
 * answers `{ success: true }`. Any invalid, expired or already-used token is a
 * 400, so `success` is always `true` on a 200.
 */
export class PublicVerifyEmailResponseDto {
  @ApiProperty({ description: 'Always true on a successful verification', example: true })
  success!: boolean;
}
