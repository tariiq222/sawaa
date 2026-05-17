"use client"

import { InvoiceListPage } from "@/components/features/invoices/invoice-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function InvoicesRoute() {
  return (
    <PermissionGuard module="invoice" action="read">
      <InvoiceListPage />
    </PermissionGuard>
  )
}
