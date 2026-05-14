export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_RESCHEDULED = 'booking_rescheduled',
  BOOKING_EXPIRED = 'booking_expired',
  BOOKING_NO_SHOW = 'booking_no_show',
  BOOKING_REMINDER = 'booking_reminder',
  BOOKING_REMINDER_URGENT = 'booking_reminder_urgent',
  BOOKING_CANCELLATION_REJECTED = 'booking_cancellation_rejected',
  CANCELLATION_REJECTED = 'cancellation_rejected',
  CANCELLATION_REQUESTED = 'cancellation_requested',
  NO_SHOW_REVIEW = 'no_show_review',
  CLIENT_ARRIVED = 'client_arrived',
  RECEIPT_REJECTED = 'receipt_rejected',
  REMINDER = 'reminder',
  PAYMENT_RECEIVED = 'payment_received',
  NEW_RATING = 'new_rating',
  PROBLEM_REPORT = 'problem_report',
  WAITLIST_SLOT_AVAILABLE = 'waitlist_slot_available',
  SYSTEM_ALERT = 'system_alert',
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}
