"use client"

import { formatPrice } from "@/lib/money"
import { useState } from "react"
import Link from "next/link"
import { Button, Skeleton } from "@sawaa/ui"
import { useClientInvoices } from "@/hooks/use-client-records"
import { useOrganizationConfig } from "@/hooks/use-organization-config"

export function ClientInvoicesPanel({ clientId, t }: { clientId: string; t: (key: string) => string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useClientInvoices(clientId, page)
  const { formatDate } = useOrganizationConfig()
  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (error) return <div role="alert" className="space-y-3 py-6"><p>{t("error.server")}</p><Button onClick={() => void refetch()}>{t("common.retry")}</Button></div>
  if (!data?.items.length) return <p className="py-8 text-center text-muted-foreground">{t("clients.dialog.noInvoices")}</p>
  return <div className="space-y-3">
    {data.items.map(invoice => <Link href={`/invoices?search=INV-${String(invoice.number).padStart(4, "0")}`} key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50">
      <span className="font-medium" dir="ltr">INV-{String(invoice.number).padStart(4, "0")}</span>
      <span>{t(`invoices.status.${invoice.status}`)}</span>
      <span>{formatPrice(Number(invoice.total))}</span>
      <span className="text-sm text-muted-foreground">{formatDate(invoice.createdAt)}</span>
    </Link>)}
    {data.meta.totalPages > 1 && <div className="flex items-center justify-between gap-3"><span>{t("table.page")} {data.meta.page} {t("table.of")} {data.meta.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={!data.meta.hasPreviousPage} onClick={() => setPage(page - 1)}>{t("table.previous")}</Button><Button variant="outline" disabled={!data.meta.hasNextPage} onClick={() => setPage(page + 1)}>{t("table.next")}</Button></div></div>}
  </div>
}
