import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response shapes of `dashboard/integrations.controller.ts` (Zoom S2S OAuth).
 *
 * These classes only document what the handlers return; they are never
 * instantiated and no interceptor rewrites the payload. Credentials are
 * write-only: the GET, PUT and POST responses carry flags / an error string
 * only — never `zoomClientId`, `zoomClientSecret`, `zoomAccountId`, ciphertext
 * or any other secret-bearing key. `platform-ops-response.dto.spec.ts` asserts
 * that both against the handler types and against the generated schemas.
 */

/** `GET /dashboard/integrations/zoom` and `PUT /dashboard/integrations/zoom` (`GetZoomConfigHandler` / `UpsertZoomConfigHandler`). */
export class ZoomConfigResponseDto {
  @ApiProperty({ description: 'Whether Zoom credentials are stored', example: true })
  configured!: boolean;

  @ApiProperty({ description: 'Whether the stored Zoom integration is active', example: true })
  isActive!: boolean;
}

/**
 * `POST /dashboard/integrations/zoom/test` (`TestZoomConfigHandler`). The
 * handler returns `{ ok: true }` on success and `{ ok: false, error }` on
 * failure, so `error` is only present when the probe failed.
 */
export class ZoomTestResultDto {
  @ApiProperty({ description: 'Whether the credentials were exchanged for an access token', example: true })
  ok!: boolean;

  @ApiPropertyOptional({ description: 'Failure reason when the probe failed (provider error message)', example: 'Invalid client credentials' })
  error?: string;
}
