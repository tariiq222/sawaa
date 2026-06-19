"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  ViewIcon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sawaa/ui"
import type { Payment } from "@/lib/types/payment"
import { formatPrice } from "@/lib/money"
import { formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  PENDING: "border-warning/40 bg-warning-soft text-warning",
  PENDING_VERIFICATION: "border-warning/40 bg-warning-soft text-warning",
  COMPLETED: "border-success/40 bg-success-soft text-success",
  REFUNDED: "border-refunded/40 bg-refunded-soft text-refunded",
  FAILED: "border-error/40 bg-error-soft text-error",
}

const METHOD_KEYS: Record<string, string> = {
  ONLINE_CARD: "payments.method.moyasar",
  BANK_TRANSFER: "payments.method.bankTransfer",
  CASH: "payments.method.cash",
  COUPON: "payments.method.coupon",
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
      accessorKey: "number",
      header: "#",
      cell: ({ row }) => {
        const payment = row.original
        const displayNumber = payment.number
          ? `PAY-${String(payment.number).padStart(4, "0")}`
          : payment.id.slice(0, 8)
        return callbacks ? (
          <button
            className="text-sm font-medium text-primary underline-offset-2 hover:underline tabular-nums"
            onClick={() => callbacks.onView(payment)}
          >
            {displayNumber}
          </button>
        ) : (
          <span className="tabular-nums text-sm text-muted-foreground">
            {displayNumber}
          </span>
        )
      },
    },
    {
      id: "client",
      header: t("payments.col.client"),
      cell: ({ row }) => {
        const inv = row.original.invoice
        const client = inv?.client
        const displayName =
          client?.firstName && client?.lastName
            ? `${client.firstName} ${client.lastName}`
            : client?.name ?? "\u2014"
        return (
          <span className="text-sm text-foreground">{displayName}</span>
        )
      },
    },
    {
      accessorKey: "amount",
      header: t("payments.col.amount"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {formatPrice(Number(row.original.amount))}
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
              {payment.status === "COMPLETED" && (
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
