"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import type { ServiceBundle } from "@/lib/types/bundle"

const iconBtnBase =
  "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

type TFn = (key: string) => string

export function getBundleColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (b: ServiceBundle) => void,
  onDelete?: (b: ServiceBundle) => void,
): ColumnDef<ServiceBundle>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("bundles.col.name", "Bundle"),
      enableSorting: false,
      cell: ({ row }) => {
        const b = row.original
        const primary = locale === "ar" ? b.nameAr : (b.nameEn ?? b.nameAr)
        const secondary = locale === "ar" ? b.nameEn : b.nameAr
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
      id: "services",
      header: label("bundles.col.services", "Services"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.items.length}
        </span>
      ),
    },
    {
      id: "subtotal",
      header: label("bundles.col.subtotal", "Subtotal"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.subtotal} {row.original.currency}
        </span>
      ),
    },
    {
      id: "discount",
      header: label("bundles.col.discount", "Discount"),
      cell: ({ row }) => {
        const b = row.original
        const display =
          b.discountType === "PERCENTAGE"
            ? `${b.discountValue}%`
            : `${b.discountValue} ${b.currency}`
        return (
          <span className="tabular-nums text-sm text-muted-foreground">{display}</span>
        )
      },
    },
    {
      id: "finalPrice",
      header: label("bundles.col.finalPrice", "Final Price"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {row.original.finalPrice} {row.original.currency}
        </span>
      ),
    },
    {
      id: "status",
      header: label("bundles.col.status", "Status"),
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
            ? label("bundles.status.active", "Active")
            : label("bundles.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: label("common.actions", "Actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={iconBtnBase}
                    aria-label={label("bundles.action.edit", "Edit")}
                    onClick={() => onEdit(b)}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label("bundles.action.edit", "Edit")}</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(iconBtnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
                    aria-label={label("bundles.action.delete", "Delete")}
                    onClick={() => onDelete(b)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label("bundles.action.delete", "Delete")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
  ]
}
