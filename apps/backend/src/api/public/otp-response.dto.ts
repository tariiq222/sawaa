import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /public/otp/verify`.
 *
 * Documentation only: `VerifyOtpHandler` mints a short-lived session token that
 * the caller exchanges for a password reset. The example is a placeholder —
 * never document a real token value.
 */
export class PublicOtpVerifyResponseDto {
  @ApiProperty({
    description: 'Short-lived OTP session token, exchanged for password reset or client sign-in',
    example: 'otp-session-token-placeholder',
  })
  sessionToken!: string;
}
