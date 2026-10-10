"use client"

import { Suspense } from "react"
import { InvoiceListPage } from "@/components/features/invoices/invoice-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function InvoicesRoute() {
  return (
    <PermissionGuard module="invoice" action="read">
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <InvoiceListPage />
      </Suspense>
    </PermissionGuard>
  )
}
