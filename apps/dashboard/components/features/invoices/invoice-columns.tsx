"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  ViewIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@sawaa/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sawaa/ui"
import type { InvoiceListItem } from "@/lib/types/invoice"
import { formatPrice } from "@/lib/money"
import { formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"

interface InvoiceColumnCallbacks {
  onView: (invoice: InvoiceListItem) => void
  onSend: (invoice: InvoiceListItem) => void
}

export function getInvoiceColumns(
  callbacks?: InvoiceColumnCallbacks,
  t: (key: string) => string = (k) => k,
  config?: { dateFormat?: DateFormat },
): ColumnDef<InvoiceListItem>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const columns: ColumnDef<InvoiceListItem>[] = [
    {
      accessorKey: "invoiceNumber",
      header: t("invoices.col.invoiceNo"),
      cell: ({ row }) => {
        const invoice = row.original
        return callbacks ? (
          <button
            className="text-sm font-medium text-primary underline-offset-2 hover:underline tabular-nums"
            onClick={() => callbacks.onView(invoice)}
          >
            {invoice.invoiceNumber}
          </button>
        ) : (
          <span className="tabular-nums text-sm font-medium text-foreground">
            {invoice.invoiceNumber}
          </span>
        )
      },
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
  ]

  if (callbacks) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const invoice = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">{t("invoices.col.actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => callbacks.onView(invoice)}>
                <HugeiconsIcon icon={ViewIcon} size={14} />
                {t("invoices.col.viewDetails")}
              </DropdownMenuItem>
              {!invoice.sentAt && (
                <DropdownMenuItem onClick={() => callbacks.onSend(invoice)}>
                  <HugeiconsIcon icon={SentIcon} size={14} />
                  {t("invoices.col.sendInvoice")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return columns
}
