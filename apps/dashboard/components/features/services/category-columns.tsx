"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { ServiceCategory } from "@/lib/types/service"

const iconBtnBase =
  "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

type TFn = (key: string) => string

export function getCategoryColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (c: ServiceCategory) => void,
  onDelete?: (c: ServiceCategory) => void,
): ColumnDef<ServiceCategory>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("services.categories.col.name", "Category"),
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original
        const primary = locale === "ar" ? c.nameAr : (c.nameEn ?? c.nameAr)
        const secondary = locale === "ar" ? c.nameEn : c.nameAr
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
      header: label("services.categories.col.services", "Services"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original._count?.services ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: label("services.categories.col.order", "Sort Order"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">{row.original.sortOrder}</span>
      ),
    },
    {
      id: "status",
      header: label("services.categories.col.status", "Status"),
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
            ? label("services.categories.status.active", "Active")
            : label("services.categories.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: label("common.actions", "Actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={iconBtnBase}
                  aria-label={label("services.categories.action.edit", "Edit")}
                  onClick={() => onEdit?.(c)}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label("services.categories.action.edit", "Edit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(iconBtnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
                  aria-label={label("services.categories.action.delete", "Delete")}
                  onClick={() => onDelete?.(c)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label("services.categories.action.delete", "Delete")}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
}
