"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DocumentAttachmentIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@sawaa/ui"
import { InvoiceStatusBadge } from "@/components/features/status-badge"
import { ApiError } from "@/lib/api"
import { generateInvoicePdf } from "@/lib/api/invoices"
import type { InvoiceListItem } from "@/lib/types/invoice"
import { formatPrice } from "@/lib/money"
import { formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"

async function handleGeneratePdf(id: string, t: (key: string) => string) {
  const toastId = toast.loading(t("invoices.generatingPdf"))
  try {
    const { url } = await generateInvoicePdf(id)
    toast.dismiss(toastId)
    window.open(url, "_blank")
  } catch (err) {
    toast.dismiss(toastId)
    if (err instanceof ApiError && err.status === 404) {
      toast.error(t("invoices.noPdfYet"))
      return
    }
    toast.error(t("invoices.downloadPdfError"))
  }
}

export function getInvoiceColumns(
  t: (key: string) => string = (k) => k,
  config?: { dateFormat?: DateFormat },
): ColumnDef<InvoiceListItem>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const columns: ColumnDef<InvoiceListItem>[] = [
    {
      accessorKey: "invoiceNumber",
      header: t("invoices.col.invoiceNo"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium text-foreground">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      id: "client",
      header: t("invoices.col.client"),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.clientName ?? "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: t("invoices.col.total"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {formatPrice(Number(row.original.totalAmount))}
        </span>
      ),
    },
    {
      accessorKey: "taxAmount",
      header: t("invoices.col.vat"),
      cell: ({ row }) => {
        const tax = row.original.taxAmount
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {tax == null ? "\u2014" : formatPrice(Number(tax))}
          </span>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: t("invoices.col.date"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatClinicDate(row.original.createdAt, dateFormat)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("invoices.col.status"),
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <InvoiceStatusBadge status={status} label={t(`invoices.status.${status}`)} />
        )
      },
    },
  ]

  columns.push({
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const invoice = row.original
      const actionLabel = invoice.hasPdf ? t("invoices.downloadPdf") : t("invoices.generatePdf")

      return (
        <Button
          aria-label={actionLabel}
          title={actionLabel}
          variant="ghost"
          size="icon-sm"
          onClick={() => handleGeneratePdf(invoice.id, t)}
        >
          <HugeiconsIcon icon={DocumentAttachmentIcon} size={16} />
        </Button>
      )
    },
  })

  return columns
}
