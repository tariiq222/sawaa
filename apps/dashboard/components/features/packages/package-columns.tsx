"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/money"
import type { SessionPackage } from "@/lib/types/package"

const iconBtnBase =
  "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

type TFn = (key: string) => string

export function getPackageColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (p: SessionPackage) => void,
  onDelete?: (p: SessionPackage) => void,
): ColumnDef<SessionPackage>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback
  // Coerce Prisma Decimal wire-format string ("16000") to number for display.
  const num = (v: number | string) => Number(v) || 0

  return [
    {
      id: "name",
      header: label("packages.col.name", "Package"),
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        const primary = locale === "ar" ? p.nameAr : (p.nameEn ?? p.nameAr)
        const secondary = locale === "ar" ? p.nameEn : p.nameAr
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{primary}</span>
            {secondary && primary !== secondary && (
              <span className="text-xs text-muted-foreground">{secondary}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "items",
      header: label("packages.col.items", "Items"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.items.length}
        </span>
      ),
    },
    {
      id: "subtotal",
      header: label("packages.col.subtotal", "Subtotal"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatPrice(num(row.original.subtotal))}
        </span>
      ),
    },
    {
      id: "discount",
      header: label("packages.col.discount", "Discount"),
      cell: ({ row }) => {
        const p = row.original
        const display =
          p.discountType === "PERCENTAGE"
            ? `${num(p.discountValue)}%`
            : formatPrice(num(p.discountValue))
        return (
          <span className="tabular-nums text-sm text-muted-foreground">{display}</span>
        )
      },
    },
    {
      id: "finalPrice",
      header: label("packages.col.finalPrice", "Final Price"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {formatPrice(num(row.original.finalPrice))}
        </span>
      ),
    },
    {
      id: "visibility",
      header: label("packages.col.visibility", "Visibility"),
      enableSorting: false,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isPublic
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isPublic
            ? label("packages.visibility.public", "Public")
            : label("packages.visibility.private", "Private")}
        </Badge>
      ),
    },
    {
      id: "status",
      header: label("packages.col.status", "Status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive
            ? label("packages.status.active", "Active")
            : label("packages.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: label("common.actions", "Actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={iconBtnBase}
                    aria-label={label("packages.action.edit", "Edit")}
                    onClick={() => onEdit(p)}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label("packages.action.edit", "Edit")}</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(iconBtnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
                    aria-label={label("packages.action.delete", "Delete")}
                    onClick={() => onDelete(p)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label("packages.action.delete", "Delete")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
  ]
}
