/**
 * Booking channel labels — Sawaa Dashboard
 *
 * A booking can be created at the front desk, by the client on the website,
 * over WhatsApp, or by the assistant in chat. Anything unrecognised reads as
 * reception, the default the backend assigns.
 */

const CHANNEL_KEYS: Record<string, string> = {
  RECEPTION: "detail.bookingChannel.reception",
  ONLINE: "detail.bookingChannel.online",
  WHATSAPP: "detail.bookingChannel.whatsapp",
  AI_CHAT: "detail.bookingChannel.aiChat",
}

export function bookingChannelKey(source: string | null | undefined): string {
  return CHANNEL_KEYS[String(source ?? "").toUpperCase()] ?? CHANNEL_KEYS.RECEPTION
}
