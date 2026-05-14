export interface NotificationListItem {
  id: string
  title: string
  body: string
  type: 'booking_confirmed' | 'booking_cancelled' | 'payment_received' | 'system' | string
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

export interface NotificationListQuery {
  page?: number
  perPage?: number
}

export interface UnreadCountResponse {
  count: number
}
