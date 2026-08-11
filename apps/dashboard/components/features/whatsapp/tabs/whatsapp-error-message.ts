export function getWhatsappErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  const message = error instanceof Error ? error.message : String(error ?? "")
  const normalized = message.toLowerCase()

  if (
    normalized.includes("connection closed") ||
    normalized.includes("evolution api 500") ||
    normalized.includes("not connected")
  ) {
    return t("whatsapp.errors.connectionClosed")
  }

  if (
    normalized.includes("evolution api 401") ||
    normalized.includes("evolution api 403") ||
    normalized.includes("authentication")
  ) {
    return t("whatsapp.errors.authentication")
  }

  return t("whatsapp.errors.generic")
}
