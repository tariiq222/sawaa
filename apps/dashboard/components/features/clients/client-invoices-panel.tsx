"use client"

interface ClientInvoicesPanelProps {
  t: (key: string) => string
}

/**
 * Renders the per-client invoices section. Invoicing has no integration wired
 * in this single-tenant deployment, so this always shows the empty-state copy.
 */
export function ClientInvoicesPanel({ t }: ClientInvoicesPanelProps) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {t("clients.dialog.noInvoices")}
    </div>
  )
}
