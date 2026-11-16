import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of the dashboard email-template routes
 * (`comms-email-templates.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Create/update return the raw persisted `EmailTemplate` row and the
 * list route wraps rows in the canonical `{ items, meta }` envelope; the
 * preview route renders subject + HTML. `email-template-response.dto.spec.ts`
 * asserts each handler result is exactly its DTO.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000e1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/**
 * One persisted `EmailTemplate` row.
 *
 * `blocks` is a Prisma `Json?` column: the create/update handlers only ever
 * write the block array (or `null` when a raw-HTML edit clears it), and the
 * dashboard renders it as the builder block list. The schema still describes
 * the column honestly as free-form JSON because the database does not enforce
 * the block vocabulary.
 */
export class EmailTemplateResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Template UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Unique slug the sender code looks the template up by', example: 'booking-confirmed' })
  slug!: string;

  @ApiProperty({ description: 'Display name shown to staff', example: 'تأكيد الحجز' })
  name!: string;

  @ApiProperty({ description: 'Email subject line (Handlebars variables allowed)', example: 'تم تأكيد حجزك' })
  subject!: string;

  @ApiProperty({ description: 'Rendered HTML body; when `blocks` is present this is derived from it', example: '<p>Hello {{name}}</p>' })
  htmlBody!: string;

  @ApiProperty({
    description:
      'Block-builder source of truth (free-form JSON column). Null for legacy raw-HTML templates; otherwise the block array the builder wrote.',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: {} },
      { type: 'object', additionalProperties: true, nullable: true },
    ],
    example: null,
  })
  blocks!: Prisma.JsonValue | null;

  @ApiProperty({ description: 'Whether the template is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `GET /dashboard/comms/email-templates` (`ListEmailTemplatesHandler.execute`). */
export class PaginatedEmailTemplatesResponseDto {
  @ApiProperty({ type: [EmailTemplateResponseDto], description: 'Templates on the requested page, oldest first' })
  items!: EmailTemplateResponseDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/** `POST /dashboard/comms/email-templates/:id/preview` (`PreviewEmailTemplateHandler.execute`). */
export class EmailTemplatePreviewResponseDto {
  @ApiProperty({ description: 'Rendered subject line (plain text, variables interpolated)', example: 'تم تأكيد حجزك' })
  subject!: string;

  @ApiProperty({ description: 'Rendered HTML body with context values escaped', example: '<p>Hello Fatima</p>' })
  body!: string;
}
