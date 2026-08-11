import { formatPrice } from "@/lib/money"
import type { Notification } from "@/lib/types/notification"

const LEGACY_PAYMENT_AMOUNT = /^(تم استلام دفع بقيمة\s+)(\d+)(\s+[A-Z]{3})$/

export function formatNotificationBody(
  notification: Pick<Notification, "body" | "type">,
): string {
  if (
    notification.type !== "PAYMENT_COMPLETED" &&
    notification.type !== "PAYMENT_RECEIVED"
  ) {
    return notification.body
  }

  return notification.body.replace(
    LEGACY_PAYMENT_AMOUNT,
    (_, prefix: string, amount: string, currency: string) =>
      `${prefix}${formatPrice(Number(amount))}${currency}`,
  )
}
