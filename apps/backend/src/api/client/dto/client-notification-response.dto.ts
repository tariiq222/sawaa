import { ApiProperty } from '@nestjs/swagger';
import type { FcmToken } from '@prisma/client';
import { NotificationResponseDto } from '../../dashboard/dto/notification-response.dto';

/**
 * Swagger response shapes for the authenticated CLIENT notification routes
 * under `src/api/client/notifications.controller.ts`:
 *
 *  - `GET  /client/notifications`              (canonical `{ items, total, page, pageSize }` page)
 *  - `GET  /client/notifications/unread-count`
 *  - `POST /client/notifications/fcm-token`
 *
 * The list reuses the shared `PaginatedNotificationsResponseDto` item schema
 * (`NotificationResponseDto`). Documentation only: no serializer is
 * registered and no `src/modules/**` file imports this layer.
 */

/**
 * `GET /client/notifications` — the canonical `/client` page envelope
 * (`toClientPage`: `{ items, total, page, pageSize }`, not the dashboard
 * `{ items, meta }` shape). Items are the shared notification rows.
 */
export class ClientNotificationPageDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'Notifications on the requested page' })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Total matching notifications', example: 8 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1, description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, description: 'Records per page', example: 20 })
  pageSize!: number;
}

/** `GET /client/notifications/unread-count`. */
export class ClientNotificationUnreadCountDto {
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Number of unread notifications for the authenticated client', example: 3 })
  count!: number;
}

/** `POST /client/notifications/fcm-token` — the stored device registration row. */
export class ClientNotificationFcmTokenDto {
  @ApiProperty({ format: 'uuid', description: 'Registration UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ description: 'FCM registration token', example: 'fcm-token-placeholder' })
  token!: string;

  @ApiProperty({ description: 'Device platform', example: 'ios' })
  platform!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last time this device registered', example: '2026-05-20T09:00:00.000Z' })
  lastSeenAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;
}

// Compile-time guard: the DTO lists exactly the Prisma `FcmToken` columns.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const clientNotificationFcmTokenMatchesPrismaRow: Equal<keyof ClientNotificationFcmTokenDto, keyof FcmToken> = true;
