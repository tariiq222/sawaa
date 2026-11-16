import { ApiProperty } from '@nestjs/swagger';
import { ProblemReportStatus, ProblemReportType, Prisma } from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of `dashboard/platform.controller.ts` (problem reports and the
 * generic third-party integration upsert/list).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. `platform-ops-response.dto.spec.ts` asserts each handler result is
 * exactly its DTO.
 *
 * Security note: `UpsertIntegrationHandler` returns the persisted `Integration`
 * row *after* encrypting the caller's config, so the POST body echoes
 * `{ config: { ciphertext } }` — the AES-256-GCM blob, never the plaintext
 * secret. `ListIntegrationsHandler` deliberately projects the column away and
 * only exposes `hasConfig`. Both pre-date this documentation change.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000d1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** One persisted `ProblemReport` row (`CreateProblemReportHandler` / `UpdateProblemReportStatusHandler`). */
export class ProblemReportResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Problem report identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'UUID of the user who submitted the report', example: '00000000-0000-4000-a000-0000000000d2' })
  reporterId!: string;

  @ApiProperty({ enum: ProblemReportType, description: 'Problem category', example: 'BUG' })
  type!: ProblemReportType;

  @ApiProperty({ description: 'Short descriptive title', example: 'Booking page crashes on submit' })
  title!: string;

  @ApiProperty({ description: 'Detailed description of the problem', example: 'Clicking confirm throws a 500 error.' })
  description!: string;

  @ApiProperty({ enum: ProblemReportStatus, description: 'Current triage status', example: 'OPEN' })
  status!: ProblemReportStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Resolution note, or null while the report is unresolved', example: null })
  resolution!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `GET /dashboard/platform/problem-reports` — the canonical `{ items, meta }` envelope. */
export class ProblemReportListResponseDto {
  @ApiProperty({ type: [ProblemReportResponseDto], description: 'Problem reports on the requested page, newest first' })
  items!: ProblemReportResponseDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/**
 * `POST /dashboard/platform/integrations` — the persisted `Integration` row the
 * upsert handler returns verbatim. `config` is a `Json` column; this route
 * writes `{ ciphertext }` (AES-256-GCM) and returns it unchanged.
 */
export class PlatformIntegrationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Integration row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Integration provider identifier', example: 'MOYASAR' })
  provider!: string;

  @ApiProperty({
    description:
      'Stored provider configuration as a free-form JSON value. This route persists the encrypted blob (`{ ciphertext }`) and echoes the row, so plaintext provider secrets are never returned.',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: {} },
      { type: 'object', additionalProperties: true, nullable: true },
    ],
  })
  config!: Prisma.JsonValue;

  @ApiProperty({ description: 'Whether the integration is currently active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** One row of `GET /dashboard/platform/integrations` — the `config` column is projected away. */
export class PlatformIntegrationListItemResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Integration row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Integration provider identifier', example: 'MOYASAR' })
  provider!: string;

  @ApiProperty({ description: 'Whether the integration is currently active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether encrypted provider configuration is stored (the config itself is never returned)', example: true })
  hasConfig!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}
