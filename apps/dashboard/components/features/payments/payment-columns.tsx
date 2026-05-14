"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  ViewIcon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deqah/ui"
import type { Payment } from "@/lib/types/payment"
import { formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  paid: "border-success/30 bg-success/10 text-success",
  refunded: "border-info/30 bg-info/10 text-info",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
}

const METHOD_KEYS: Record<string, string> = {
  moyasar: "payments.method.moyasar",
  bank_transfer: "payments.method.bankTransfer",
}

interface PaymentColumnCallbacks {
  onView: (payment: Payment) => void
  onRefund: (payment: Payment) => void
}

export function getPaymentColumns(
  callbacks?: PaymentColumnCallbacks,
  t: (key: string) => string = (k) => k,
  config?: { dateFormat?: DateFormat },
): ColumnDef<Payment>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ row }) => {
        const payment = row.original
        return callbacks ? (
          <button
            className="text-sm font-medium text-primary underline-offset-2 hover:underline tabular-nums"
            onClick={() => callbacks.onView(payment)}
          >
            {payment.id.slice(0, 8)}
          </button>
        ) : (
          <span className="tabular-nums text-sm text-muted-foreground">
            {payment.id.slice(0, 8)}
          </span>
        )
      },
    },
    {
      id: "client",
      header: t("payments.col.client"),
      cell: ({ row }) => {
        const p = row.original.booking?.client
        return (
          <span className="text-sm text-foreground">
            {p ? `${p.firstName} ${p.lastName}` : "\u2014"}
          </span>
        )
      },
    },
    {
      accessorKey: "totalAmount",
      header: t("payments.col.amount"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {(row.original.totalAmount / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: t("payments.col.method"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {METHOD_KEYS[row.original.method]
            ? t(METHOD_KEYS[row.original.method])
            : row.original.method}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("payments.col.status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={statusStyles[row.original.status] ?? ""}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("payments.col.date"),
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
        const payment = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">{t("payments.col.actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => callbacks.onView(payment)}>
                <HugeiconsIcon icon={ViewIcon} size={14} />
                {t("payments.col.viewDetails")}
              </DropdownMenuItem>
              {payment.status === "paid" && (
                <DropdownMenuItem onClick={() => callbacks.onRefund(payment)}>
                  <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={14} />
                  {t("payments.col.refund")}
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
