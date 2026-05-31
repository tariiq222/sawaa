import type { ErrorEvent } from "@sentry/nextjs"

const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|setcookie|token|refresh|access|password|secret|apikey|otp|code)/i
const REDACTED = "[REDACTED]"
const MAX_REDACTION_DEPTH = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.replace(/[^a-z0-9]/gi, ""))
}

function redactSensitiveString(value: string): string {
  return value
    .replace(
      /(^|[?&])([^=&#\s]*(?:authorization|cookie|set-cookie|token|refresh|access|password|secret|apiKey|otp|code)[^=&#\s]*)=([^&#\s]*)/gi,
      (_match, prefix: string, key: string) => `${prefix}${key}=${REDACTED}`,
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\b(authorization|cookie|set-cookie|token|refresh|access|password|secret|apiKey|otp|code)(["']?\s*[:=]\s*["']?)([^&"'\s,;}]+)/gi,
      (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`,
    )
}

function redactDeep(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (typeof value === "string") return redactSensitiveString(value)
  if (depth > MAX_REDACTION_DEPTH) return REDACTED
  if (Array.isArray(value)) {
    if (seen.has(value)) return REDACTED
    seen.add(value)
    return value.map((child) => redactDeep(child, seen, depth + 1))
  }
  if (!isRecord(value)) return value
  if (seen.has(value)) return REDACTED
  seen.add(value)

  const redacted: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = isSensitiveKey(key)
      ? REDACTED
      : redactDeep(child, seen, depth + 1)
  }
  return redacted
}

export function redactSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    message: event.message ? redactSensitiveString(event.message) : event.message,
    exception: event.exception
      ? (redactDeep(event.exception) as ErrorEvent["exception"])
      : event.exception,
    extra: event.extra ? (redactDeep(event.extra) as ErrorEvent["extra"]) : event.extra,
    contexts: event.contexts
      ? (redactDeep(event.contexts) as ErrorEvent["contexts"])
      : event.contexts,
    tags: event.tags ? (redactDeep(event.tags) as ErrorEvent["tags"]) : event.tags,
    user: event.user ? (redactDeep(event.user) as ErrorEvent["user"]) : event.user,
    breadcrumbs: event.breadcrumbs?.map(
      (breadcrumb) => redactDeep(breadcrumb) as typeof breadcrumb,
    ),
    request: event.request
      ? (redactDeep(event.request) as ErrorEvent["request"])
      : event.request,
  }
}
