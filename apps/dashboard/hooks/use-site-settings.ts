"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import {
  bulkUpsertSiteSettings,
  fetchSiteSettings,
} from "@/lib/api/site-settings"
import type { BulkUpsertSiteSettingsPayload } from "@/lib/types/site-settings"
import { ApiError } from "@/lib/api"

export function useSiteSettings(prefix?: string) {
  return useQuery({
    queryKey: queryKeys.siteSettings.list(prefix),
    queryFn: () => fetchSiteSettings(prefix),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpsertSiteSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: BulkUpsertSiteSettingsPayload) =>
      bulkUpsertSiteSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings.all })
      toast.success("تم حفظ المحتوى")
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "فشل حفظ المحتوى"
      toast.error(message)
    },
  })
}
