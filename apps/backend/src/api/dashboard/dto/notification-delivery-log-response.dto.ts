import { ApiProperty } from '@nestjs/swagger';
import {
  DeliveryChannel,
  DeliveryStatus,
  NotificationPriority,
  NotificationSenderActor,
  NotificationType,
} from '@prisma/client';

const DELIVERY_LOG_EXAMPLE = '00000000-4000-4000-a000-000000000001';
const ISO_EXAMPLE = '2026-03-01T10:00:00.000Z';

/**
 * One `NotificationDeliveryLog` row as returned by
 * `GET /dashboard/comms/delivery-logs`.
 *
 * The handler selects exactly these columns
 * (`list-tenant-delivery-logs.handler.ts`); `jobId` and `updatedAt` exist on the
 * model but are not projected, so they are not documented.
 */
export class NotificationDeliveryLogRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Delivery log identifier', example: DELIVERY_LOG_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Recipient identifier (client or employee UUID depending on the notification type)', example: '11111111-1111-4111-8111-111111111111' })
  recipientId!: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type that produced this delivery', example: 'BOOKING_CONFIRMED' })
  type!: NotificationType;

  @ApiProperty({ enum: NotificationPriority, description: 'Notification priority', example: 'STANDARD' })
  priority!: NotificationPriority;

  @ApiProperty({ enum: DeliveryChannel, description: 'Delivery channel', example: 'EMAIL' })
  channel!: DeliveryChannel;

  @ApiProperty({ enum: DeliveryStatus, description: 'Delivery status', example: 'SENT' })
  status!: DeliveryStatus;

  @ApiProperty({ enum: NotificationSenderActor, description: 'Actor the notification was sent on behalf of', example: 'TENANT' })
  senderActor!: NotificationSenderActor;

  @ApiProperty({ type: String, nullable: true, description: 'Destination address used for this delivery, or null', example: 'client@example.com' })
  toAddress!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider that handled the delivery, or null while pending', example: 'RESEND' })
  providerName!: string | null;

  @ApiProperty({ type: 'integer', description: 'Number of delivery attempts', example: 1 })
  attempts!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Last attempt timestamp, or null', example: ISO_EXAMPLE })
  lastAttemptAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Successful send timestamp, or null', example: ISO_EXAMPLE })
  sentAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last error message, or null', example: null })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Row creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/** Pagination envelope of the delivery-log list. */
export class NotificationDeliveryLogListMetaDto {
  @ApiProperty({ type: 'integer', minimum: 1, description: 'Current page (1-based)', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Total matching rows', example: 42 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Total pages', example: 3 })
  totalPages!: number;
}

/** `GET /dashboard/comms/delivery-logs` response. */
export class PaginatedNotificationDeliveryLogsDto {
  @ApiProperty({ type: [NotificationDeliveryLogRecordDto], description: 'Delivery logs, newest first' })
  items!: NotificationDeliveryLogRecordDto[];

  @ApiProperty({ type: NotificationDeliveryLogListMetaDto, description: 'Pagination metadata' })
  meta!: NotificationDeliveryLogListMetaDto;
}
