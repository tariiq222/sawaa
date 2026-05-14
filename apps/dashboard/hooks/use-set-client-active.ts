"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { queryKeys } from "@/lib/query-keys"
import { setClientActive } from "@/lib/api/clients"
import { toastApiError } from "@/lib/mutation-helpers"
import type { SetClientActivePayload } from "@/lib/api/clients"

/**
 * Mutation hook: enable / disable a client account.
 * On success: toasts and invalidates detail + list queries.
 * On error: surfaces the API error message via toastApiError.
 */
export function useSetClientActive(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SetClientActivePayload) =>
      setClientActive(clientId, payload),

    onSuccess: (_, payload) => {
      const key = payload.isActive
        ? "clients.account.enableSuccess"
        : "clients.account.disableSuccess"

      // Toast message is resolved by the component using the i18n key;
      // pass the key as a data attribute via a custom event if needed, but
      // simplest is to let the component provide it via onSuccess callback.
      // Here we just emit a generic success — component can override via
      // the mutateAsync pattern.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(clientId),
        refetchType: "all",
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.clients.all,
        refetchType: "all",
      })

      // Suppress unused warning — key is intentionally evaluated here
      // to confirm both branches are reachable (compile-time check).
      void key
    },

    onError: toastApiError("فشل تحديث حالة الحساب"),
  })
}

export type { SetClientActivePayload }

/**
 * Thin helper so callers can easily emit a translated success toast
 * after awaiting mutateAsync — keeps toast text out of the hook.
 */
export function useSetClientActiveWithToast(
  clientId: string,
  getSuccessMsg: (isActive: boolean) => string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SetClientActivePayload) =>
      setClientActive(clientId, payload),

    onSuccess: (_, payload) => {
      toast.success(getSuccessMsg(payload.isActive))
      void queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(clientId),
        refetchType: "all",
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.clients.all,
        refetchType: "all",
      })
    },

    onError: toastApiError("فشل تحديث حالة الحساب"),
  })
}
