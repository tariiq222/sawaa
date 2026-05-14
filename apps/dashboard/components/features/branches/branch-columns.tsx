"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Delete02Icon,
  UserGroupIcon,
  StarIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deqah/ui"
import type { Branch } from "@/lib/types/branch"

type TFn = (key: string) => string

export function getBranchColumns(
  locale: "en" | "ar" = "en",
  onEdit?: (b: Branch) => void,
  onDelete?: (b: Branch) => void,
  t?: TFn,
  onManageEmployees?: (b: Branch) => void,
  onToggleActive?: (b: Branch) => void,
  onSetPrimary?: (b: Branch) => void,
): ColumnDef<Branch>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("branches.col.name", "Name"),
      enableSorting: false,
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {locale === "ar" ? b.nameAr : b.nameEn}
            </span>
            <span className="text-xs text-muted-foreground">
              {locale === "ar" ? b.nameEn : b.nameAr}
            </span>
          </div>
        )
      },
    },
    {
      id: "address",
      header: label("branches.col.address", "Address"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.addressAr || row.original.addressEn || "—"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: label("branches.col.phone", "Phone"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground" dir="ltr">
          {row.original.phone || "—"}
        </span>
      ),
    },
    {
      id: "main",
      header: label("branches.col.main", "Main"),
      cell: ({ row }) => {
        if (!row.original.isMain) return null
        return (
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary"
          >
            {label("branches.status.main", "Main")}
          </Badge>
        )
      },
    },
    {
      id: "status",
      header: label("branches.col.status", "Status"),
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
            ? label("branches.status.active", "Active")
            : label("branches.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const b = row.original
        return (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                    <span className="sr-only">{label("common.actions", "Actions")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">{label("common.actions", "Actions")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="glass-solid">
              <DropdownMenuItem onClick={() => onManageEmployees?.(b)}>
                <HugeiconsIcon icon={UserGroupIcon} size={14} />
                {label("branches.action.employees", "Employees")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(b)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("branches.action.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive?.(b)}>
                <HugeiconsIcon icon={b.isActive ? Cancel01Icon : CheckmarkCircle02Icon} size={14} />
                {label(
                  b.isActive ? "branches.action.deactivate" : "branches.action.activate",
                  b.isActive ? "Deactivate" : "Activate",
                )}
              </DropdownMenuItem>
              {!b.isMain && (
                <DropdownMenuItem onClick={() => onSetPrimary?.(b)}>
                  <HugeiconsIcon icon={StarIcon} size={14} />
                  {label("branches.action.setPrimary", "Set as Primary")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete?.(b)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {label("branches.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
