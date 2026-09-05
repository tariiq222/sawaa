import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, RecipientType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification UUID' })
  id!: string;

  @ApiProperty({ description: 'Recipient user UUID' })
  recipientId!: string;

  @ApiProperty({ description: 'Recipient type', enum: RecipientType })
  recipientType!: RecipientType;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title!: string;

  @ApiProperty({ description: 'Notification body' })
  body!: string;

  @ApiProperty({
    description: 'Notification metadata. JSON scalars, arrays, objects, or null are allowed.',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: {} },
      { type: 'object', additionalProperties: true, nullable: true },
    ],
  })
  metadata!: unknown | null;

  @ApiProperty({ description: 'Whether the notification has been read' })
  isRead!: boolean;

  @ApiProperty({ description: 'Read timestamp', type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class NotificationListMetaDto {
  @ApiProperty({ description: 'Total matching notifications' })
  total!: number;

  @ApiProperty({ description: '1-based page number' })
  page!: number;

  @ApiProperty({ description: 'Notifications per page' })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists' })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists' })
  hasPreviousPage!: boolean;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'Notifications on the requested page' })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: NotificationListMetaDto, description: 'Pagination metadata' })
  meta!: NotificationListMetaDto;
}

export class UnreadNotificationCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications' })
  count!: number;
}
