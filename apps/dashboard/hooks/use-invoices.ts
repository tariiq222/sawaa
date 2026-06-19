"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchInvoices } from "@/lib/api/invoices"
import type { InvoiceListItem, InvoiceListRow } from "@/lib/types/invoice"

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
  const [search, setSearch] = useState("")

  const trimmedSearch = search.trim()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.invoices.list({ page, search: trimmedSearch }),
    queryFn: () =>
      fetchInvoices({ page, limit: 20, search: trimmedSearch || undefined }),
    staleTime: 5 * 60 * 1000,
  })

  const invoices: InvoiceListItem[] = (data?.items ?? []).map(toInvoiceListItem)

  return {
    invoices,
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
  }
}
