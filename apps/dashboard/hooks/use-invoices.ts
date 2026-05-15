"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchInvoicePayments } from "@/lib/api/invoices"

export function useInvoices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.invoices.list({ page }),
    queryFn: () => fetchInvoicePayments({ page, limit: 20 }),
    staleTime: 5 * 60 * 1000,
  })

  return {
    payments: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
  }
}
