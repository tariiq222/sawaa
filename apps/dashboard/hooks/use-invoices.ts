"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchInvoicePayments } from "@/lib/api/invoices"
import type { InvoiceListItem } from "@/lib/types/invoice"
import type { Payment } from "@/lib/types/payment"

export function toInvoiceListItem(payment: Payment): InvoiceListItem {
  return {
    id: payment.id,
    invoiceNumber: payment.invoiceId || payment.id.slice(0, 8).toUpperCase(),
    clientName: null, // client names are not exposed in payment list
    totalAmount: payment.amount,
    taxAmount: null, // tax not exposed in payment list
    createdAt: payment.createdAt,
    status: payment.status,
    sentAt: null,
  }
}

export function useInvoices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.invoices.list({ page }),
    queryFn: () => fetchInvoicePayments({ page, limit: 20 }),
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
