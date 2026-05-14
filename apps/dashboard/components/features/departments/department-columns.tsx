"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { Department } from "@/lib/types/department"

const iconBtnBase =
  "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

type TFn = (key: string) => string

export function getDepartmentColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (d: Department) => void,
  onDelete?: (d: Department) => void,
  onToggleActive?: (d: Department) => void,
): ColumnDef<Department>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("departments.col.name", "Name"),
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original
        const primary = locale === "ar" ? d.nameAr : d.nameEn
        const secondary = locale === "ar" ? d.nameEn : d.nameAr
        return (
          <div className="flex max-w-[280px] flex-col">
            <span
              className="truncate font-medium text-foreground"
              title={primary ?? undefined}
            >
              {primary}
            </span>
            <span
              className="truncate text-xs text-muted-foreground"
              title={secondary ?? undefined}
            >
              {secondary}
            </span>
          </div>
        )
      },
    },
    {
      id: "categories",
      header: label("departments.col.categories", "Categories"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original._count?.categories ?? 0}
        </span>
      ),
    },
    {
      id: "status",
      header: label("departments.col.status", "Status"),
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
            ? label("departments.status.active", "Active")
            : label("departments.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: label("common.actions", "Actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={iconBtnBase}
                  aria-label={label("departments.action.edit", "Edit")}
                  onClick={() => onEdit?.(d)}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label("departments.action.edit", "Edit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(iconBtnBase, d.isActive ? "hover:text-warning hover:bg-warning/10 hover:border-warning/20" : "hover:text-success hover:bg-success/10 hover:border-success/20")}
                  aria-label={d.isActive ? label("departments.action.deactivate", "Deactivate") : label("departments.action.activate", "Activate")}
                  onClick={() => onToggleActive?.(d)}
                >
                  <HugeiconsIcon icon={d.isActive ? Cancel01Icon : CheckmarkCircle02Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {d.isActive ? label("departments.action.deactivate", "Deactivate") : label("departments.action.activate", "Activate")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(iconBtnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
                  aria-label={label("departments.action.delete", "Delete")}
                  onClick={() => onDelete?.(d)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label("departments.action.delete", "Delete")}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
}
