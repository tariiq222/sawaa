import type { components, paths } from './generated/openapi'

type Schemas = components['schemas']
type NotificationRow = Schemas['NotificationResponseDto']

/**
 * Row of `GET /api/v1/dashboard/comms/notifications`
 * (`NotificationResponseDto`), projected to the keys this legacy type exposed.
 * Documented → legacy: `metadata` → `data` (same JSON value).
 */
export type NotificationListItem = Pick<
  NotificationRow,
  'id' | 'title' | 'body' | 'isRead' | 'createdAt'
> & {
  /**
   * Documented as a closed enum; the old exported contract was an open string
   * union (`… | string`), so it is preserved to avoid narrowing consumers.
   */
  type: NotificationRow['type'] | (string & {})
  /** Renamed from the documented `metadata`; same free-form JSON value. */
  data?: Record<string, unknown>
}

/** Query of the list operation: paging controls the old type exposed. */
export interface NotificationListQuery {
  page?: NonNullable<
    paths['/api/v1/dashboard/comms/notifications']['get']['parameters']['query']
  >['page']
  limit?: NonNullable<
    paths['/api/v1/dashboard/comms/notifications']['get']['parameters']['query']
  >['limit']
}

/** 200 body of `GET /api/v1/dashboard/comms/notifications/unread-count`. */
export type UnreadCountResponse = Schemas['UnreadNotificationCountResponseDto']
