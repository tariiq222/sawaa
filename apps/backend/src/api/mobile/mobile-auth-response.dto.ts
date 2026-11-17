import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shapes for the mobile auth routes in
 * `MobileClientAuthController` that previously had no documented success
 * schema. Documentation-only: every class documents what the existing handler
 * returns, and no serializer is registered, so it cannot change the payload.
 */

/** Native access/refresh token pair issued by `POST /mobile/auth/refresh`. */
export class MobileAuthTokenPairDto {
  @ApiProperty({
    description: 'Native access token (JWT). Never logged or persisted outside the device secure store.',
    example: 'synthetic-access-token',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Rotated native refresh token; the presented token is revoked on success.',
    example: 'synthetic-refresh-token',
  })
  refreshToken!: string;
}

/** Result of `POST /mobile/auth/register` (account created, SMS OTP sent). */
export class MobileAuthRegisteredUserDto {
  @ApiProperty({
    format: 'uuid',
    description: 'User id of the pending self-signup that must verify its phone OTP.',
    example: '00000000-0000-4000-a000-000000000001',
  })
  userId!: string;

  @ApiProperty({
    description: 'Phone number masked for display; the full number never echoes back.',
    example: '+966***78',
  })
  maskedPhone!: string;
}

/** Result of `POST /mobile/auth/request-email-verification`. */
export class MobileAuthEmailVerificationSentDto {
  @ApiProperty({
    description: 'True when the verification email was enqueued (also true when the email was already verified).',
    example: true,
  })
  success!: boolean;
}

/** Result of `POST /mobile/auth/request-login-otp`. */
export class MobileAuthLoginOtpSentDto {
  @ApiProperty({
    description: 'Identifier masked for display; a generic value is returned even when no code was sent.',
    example: 'p***@example.test',
  })
  maskedIdentifier!: string;
}
