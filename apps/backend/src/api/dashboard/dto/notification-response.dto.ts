import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, RecipientType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Recipient identifier', example: '00000000-0000-4000-a000-000000000002' })
  recipientId!: string;

  @ApiProperty({ description: 'Recipient kind', enum: RecipientType, example: 'EMPLOYEE' })
  recipientType!: RecipientType;

  @ApiProperty({ description: 'Notification event type', enum: NotificationType, example: 'GENERAL' })
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title', example: 'Appointment reminder' })
  title!: string;

  @ApiProperty({ description: 'Notification body', example: 'Your appointment starts soon' })
  body!: string;

  @ApiProperty({ description: 'Optional context supplied by notification writers', type: 'object', additionalProperties: true, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ description: 'Whether the recipient has read the notification', example: false })
  isRead!: boolean;

  @ApiProperty({ description: 'Read timestamp', type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class NotificationListMetaDto {
  @ApiProperty({ description: 'Total matching notifications', example: 21 })
  total!: number;

  @ApiProperty({ description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Records per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages', example: 2 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ description: 'Notifications on the requested page', type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: NotificationListMetaDto })
  meta!: NotificationListMetaDto;
}

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications', example: 5 })
  count!: number;
}
