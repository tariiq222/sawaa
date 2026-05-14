"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { fetchBranding, updateBranding } from "@/lib/api/branding"
import type { UpdateBrandingPayload } from "@/lib/types/branding"
import { ApiError } from "@/lib/api"

export function useBranding() {
  return useQuery({
    queryKey: queryKeys.branding.config(),
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandingPayload) => updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branding.all })
      queryClient.invalidateQueries({ queryKey: ["branding", "public"] })
      toast.success("تم حفظ إعدادات الهوية")
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "فشل حفظ إعدادات الهوية"
      toast.error(message)
    },
  })
}
