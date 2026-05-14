import { toast } from "sonner"
import { ApiError } from "@/lib/api"

/**
 * Returns an onError handler that surfaces a red toast.
 * Prefers the server's message when it's an ApiError (e.g. 400 validation),
 * falls back to the provided Arabic `fallback` string for network/unknown errors.
 *
 * Usage:
 *   useMutation({ mutationFn: ..., onError: toastApiError("فشل حفظ البيانات") })
 */
export function toastApiError(fallback: string) {
  return (err: unknown) => {
    const message = err instanceof ApiError ? err.message : fallback
    toast.error(message)
  }
}
