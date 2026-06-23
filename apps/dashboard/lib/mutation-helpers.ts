import { toast } from "sonner"
import { ApiError } from "@/lib/api"

function requestIdOf(err: ApiError): string | undefined {
  if (err.body && typeof err.body === "object" && "requestId" in err.body) {
    const v = (err.body as { requestId?: unknown }).requestId
    return typeof v === "string" ? v : undefined
  }
  return undefined
}

export interface ApiErrorToastOptions {
  /** Localized fallback message for network / unknown / 5xx errors. */
  fallback: string
  /** Optional translator, used to localize generic network/server messages. */
  t?: (key: string) => string
  /** sonner toast id — coalesces duplicate errors into a single toast. */
  dedupeKey?: string
}

/**
 * Show a single, user-friendly error toast for an API/mutation failure.
 *
 * - 401 is silent — AuthGate owns the session-expired UX, a red toast here is
 *   just noise before the redirect.
 * - 5xx → localized generic message (+ requestId for support) instead of the
 *   raw English NestJS string.
 * - network errors → localized "could not reach server".
 * - 4xx → the server's message (usually the most specific), else the fallback.
 */
export function showApiError(err: unknown, opts: ApiErrorToastOptions): void {
  const { fallback, t, dedupeKey } = opts
  const emit = (msg: string) => {
    if (dedupeKey) toast.error(msg, { id: dedupeKey })
    else toast.error(msg)
  }

  if (err instanceof ApiError) {
    if (err.status === 401) return // session handled by AuthGate — no toast
    if (err.status >= 500) {
      const base = t ? t("error.server") : fallback
      const rid = requestIdOf(err)
      emit(rid ? `${base} (${rid})` : base)
      return
    }
    // 4xx — prefer the server message (most specific), fall back if empty.
    emit(err.message || fallback)
    return
  }

  if (err instanceof Error && /fetch|network|load failed/i.test(err.message)) {
    emit(t ? t("error.network") : fallback)
    return
  }

  emit(fallback)
}

/**
 * Convenience onError factory (backward-compatible).
 *
 *   useMutation({ mutationFn: ..., onError: toastApiError("فشل حفظ البيانات") })
 *
 * Pass `t` to localize generic 5xx/network messages; without it, the provided
 * `fallback` is used for those cases. 401 is always silent.
 */
export function toastApiError(fallback: string, t?: (key: string) => string) {
  return (err: unknown) => showApiError(err, { fallback, t })
}
