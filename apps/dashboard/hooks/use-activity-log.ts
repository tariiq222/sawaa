"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { fetchActivityLogs } from "@/lib/api/activity-log"
import type { ActivityLogQuery } from "@/lib/types/activity-log"
import { ApiError } from "@/lib/api"

const QUERY_KEY = ["activity-log"] as const

export function useActivityLogs() {
  const [page, setPage] = useState(1)
  const [module, setModule] = useState<string | undefined>()
  const [action, setAction] = useState<string | undefined>()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query: ActivityLogQuery = {
    page,
    perPage: 20,
    module,
    action,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, "list", query],
    queryFn: () => fetchActivityLogs(query),
  })

  const hasFilters = !!module || !!action || !!dateFrom || !!dateTo

  const resetFilters = useCallback(() => {
    setModule(undefined)
    setAction(undefined)
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }, [])

  // NestJS validation errors (array messages) are flattened by parseErrorBody()
  // in lib/api.ts → joined as a comma-separated string. So plain Error.message
  // is sufficient here. ApiError is checked first to keep code/status reachable
  // for future consumers.
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : (error.message ?? null)
    : null

  return {
    logs: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: errorMessage,
    page,
    setPage,
    module,
    setModule: (m: string | undefined) => { setModule(m); setPage(1) },
    action,
    setAction: (a: string | undefined) => { setAction(a); setPage(1) },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasFilters,
    resetFilters,
  }
}
