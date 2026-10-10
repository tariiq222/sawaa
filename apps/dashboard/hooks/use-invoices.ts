"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { queryKeys } from "@/lib/query-keys"
import { fetchInvoices } from "@/lib/api/invoices"
import type {
  InvoiceListItem,
  InvoiceListRow,
  InvoiceStatus,
} from "@/lib/types/invoice"

export function toInvoiceListItem(row: InvoiceListRow): InvoiceListItem {
  return {
    id: row.id,
    invoiceNumber: `INV-${String(row.number).padStart(4, "0")}`,
    clientName: row.clientName,
    totalAmount: Number(row.total),
    taxAmount: row.vatAmt == null ? null : Number(row.vatAmt),
    createdAt: row.issuedAt ?? row.createdAt,
    status: row.status,
    sentAt: row.sentToClientAt,
    hasPdf: row.hasPdf,
  }
}

export function useInvoices() {
  const [page, setPage] = useState(1)
  const searchParams = useSearchParams()
  const [searchOverride, setSearch] = useState<string | undefined>()
  const search = searchOverride ?? searchParams?.get("search") ?? ""

  const [status, setStatusState] = useState<InvoiceStatus | undefined>()

  const trimmedSearch = search.trim()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.invoices.list({
      page,
      search: trimmedSearch,
      ...(status ? { status } : {}),
    }),
    queryFn: () =>
      fetchInvoices({
        page,
        limit: 20,
        search: trimmedSearch || undefined,
        status,
      }),
    staleTime: 5 * 60 * 1000,
    // Payment mutations explicitly refetch inactive invoice queries because
    // the provider intentionally disables automatic mount refetches.
    refetchOnMount: false,
  })

  const invoices: InvoiceListItem[] = (data?.items ?? []).map(toInvoiceListItem)

  return {
    invoices,
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    refetch: () => {
      void refetch()
    },
    page,
    setPage,
    search,
    status,
    setStatus: (value: InvoiceStatus | undefined) => {
      setStatusState(value)
      setPage(1)
    },
    setSearch: (s: string) => {
      setSearch(s)
      setPage(1)
    },
  }
}
