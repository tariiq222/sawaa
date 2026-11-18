import { ApiProperty } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';

/**
 * Swagger response shape for `POST /public/contact-messages`.
 *
 * Documentation only: `CreateContactMessageHandler` inserts the row and
 * returns exactly the `id` / `createdAt` / `status` projection selected at
 * creation time. The submission is unauthenticated and touches no session.
 */
export class PublicContactMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Created contact message identifier', example: '00000000-4000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-10-10T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    enum: ContactMessageStatus,
    description: 'Initial triage status (always NEW on creation)',
    example: 'NEW',
  })
  status!: ContactMessageStatus;
}
