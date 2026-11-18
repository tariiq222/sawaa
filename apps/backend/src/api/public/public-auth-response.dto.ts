import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shape for the three client session routes in
 * `src/api/public/public-auth.controller.ts`:
 *
 *   POST /public/auth/register
 *   POST /public/auth/login
 *   POST /public/auth/refresh
 *
 * All three return exactly `{ clientId }`. The access and refresh credentials
 * are NOT in the body: they are delivered only as the `httpOnly` cookies
 * `client_access_token` and `client_refresh_token` (see `setAuthCookies`).
 * This schema documents the cookie NAMES, never a token value.
 *
 * Documentation only: no serializer is registered, so this class cannot shape
 * a response, and nothing under `src/modules/**` imports it.
 */
export class PublicAuthClientSessionResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Authenticated (or newly created) client UUID. Session credentials are set as the httpOnly cookies `client_access_token` and `client_refresh_token`; no token value is ever returned in the body.',
    example: '00000000-0000-4000-a000-000000000001',
  })
  clientId!: string;
}
