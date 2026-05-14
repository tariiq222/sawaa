"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
  StarIcon,
  ViewIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { formatName, getInitials, getAvatarGradientStyle } from "@/lib/utils"

import { Avatar, AvatarFallback } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { Employee } from "@/lib/types/employee"


function RatingDisplay({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-sm text-muted-foreground">&mdash;</span>

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-sm text-foreground">
      <HugeiconsIcon
        icon={StarIcon}
        size={14}
        className="text-warning"
      />
      {value.toFixed(1)}
    </span>
  )
}

export function getEmployeeColumns(
  onRowClick: (p: Employee) => void,
  locale: "en" | "ar" = "en",
  onEdit?: (p: Employee) => void,
  onDelete?: (p: Employee) => void,
  t?: (key: string) => string,
  onPreview?: (p: Employee) => void,
  onToggleActive?: (p: Employee) => void,
): ColumnDef<Employee>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => `${row.user.firstName} ${row.user.lastName}`,
      header: t?.("employees.col.employee") ?? "Employee",
      enableSorting: true,
      cell: ({ row }) => {
        const p = row.original
        const name = formatName(p.user.firstName, p.user.lastName)
        const initials = getInitials(p.user.firstName, p.user.lastName)
        const specialty = p.specialty
        return (
          <button
            onClick={() => onRowClick(p)}
            className="flex min-w-0 items-center gap-3 text-start"
            aria-label={name}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback
                className="text-[11px] font-semibold text-primary-foreground"
                style={getAvatarGradientStyle(p.id)}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {specialty ?? "\u2014"}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      id: "email",
      header: t?.("employees.col.email") ?? "Email",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.user.email}
        </span>
      ),
    },
    {
      accessorKey: "experience",
      header: t?.("employees.col.experience") ?? "Experience",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-foreground">
          {row.original.experience != null
            ? `${row.original.experience} ${t?.("employees.col.experienceYrs") ?? "yrs"}`
            : "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "averageRating",
      header: t?.("employees.col.rating") ?? "Rating",
      enableSorting: false,
      cell: ({ row }) => <RatingDisplay value={row.original.averageRating} />,
    },
    {
      id: "isActive",
      header: t?.("employees.col.status") ?? "Status",
      enableSorting: true,
      cell: ({ row }) => {
        const active = row.original.isActive
        return (
          <Badge
            variant="outline"
            className={
              active
                ? "border-success/20 bg-success/10 text-success font-medium"
                : "border-border bg-muted text-muted-foreground font-medium"
            }
          >
            <span className={`me-1.5 inline-block size-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />
            {active ? (t?.("employees.status.active") ?? "Active") : (t?.("employees.status.suspended") ?? "Suspended")}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: t?.("employees.col.actions") ?? "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        const btn = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={btn} onClick={() => onPreview?.(p)} aria-label={t?.("common.preview") ?? "Preview"}>
                  <HugeiconsIcon icon={ViewIcon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t?.("common.preview") ?? "Preview"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={btn} onClick={() => onEdit?.(p)} aria-label={t?.("common.edit") ?? "Edit"}>
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t?.("common.edit") ?? "Edit"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(btn, p.isActive ? "hover:text-warning hover:bg-warning/10 hover:border-warning/20" : "hover:text-success hover:bg-success/10 hover:border-success/20")}
                  onClick={() => onToggleActive?.(p)}
                  aria-label={p.isActive ? (t?.("employees.action.deactivate") ?? "Deactivate") : (t?.("employees.action.activate") ?? "Activate")}
                >
                  <HugeiconsIcon icon={p.isActive ? Cancel01Icon : CheckmarkCircle02Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {p.isActive ? (t?.("employees.action.deactivate") ?? "Deactivate") : (t?.("employees.action.activate") ?? "Activate")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(btn, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
                  onClick={() => onDelete?.(p)}
                  aria-label={t?.("common.delete") ?? "Delete"}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t?.("common.delete") ?? "Delete"}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
}
