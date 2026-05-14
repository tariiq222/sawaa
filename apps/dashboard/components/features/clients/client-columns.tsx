"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { getInitials, formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"
import {
  ViewIcon,
  PencilEdit01Icon,
  UserCheck01Icon,
  UserBlock01Icon,
  MailValidation01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import type { Client } from "@/lib/types/client"

interface ClientColumnOptions {
  onRowClick: (client: Client) => void
  onViewClick: (client: Client) => void
  onEditClick: (client: Client) => void
  onToggleActive: (client: Client) => void
  onDeleteClick: (client: Client) => void
  t: (key: string) => string
  locale?: "ar" | "en"
  dateFormat?: DateFormat
}

export function getClientColumns({
  onRowClick,
  onViewClick,
  onEditClick,
  onToggleActive,
  onDeleteClick,
  t,
  locale = "ar",
  dateFormat = "Y-m-d",
}: ClientColumnOptions): ColumnDef<Client>[] {
  return [
    {
      id: "client",
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      header: t("clients.col.client"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const nameA = `${a.original.firstName} ${a.original.lastName}`
        const nameB = `${b.original.firstName} ${b.original.lastName}`
        return nameA.localeCompare(nameB, "ar")
      },
      cell: ({ row }) => {
        const p = row.original
        const initials = getInitials(p.firstName, p.lastName)
        return (
          <button onClick={() => onRowClick(p)} className="flex items-center gap-3 text-start">
            <Avatar className="size-8">
              {p.avatarUrl ? (
                <AvatarImage src={p.avatarUrl} alt={`${p.firstName} ${p.lastName}`} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">
                  {p.firstName} {p.lastName}
                </p>
                {(p.accountType === "walk_in" || p.accountType === "WALK_IN") && (
                  <span className="rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    {t("clients.detail.walkIn")}
                  </span>
                )}
                {p.emailVerified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center">
                        <HugeiconsIcon icon={MailValidation01Icon} size={14} className="text-success" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("clients.otpVerified")}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {p.email}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      accessorKey: "phone",
      header: t("clients.col.phone"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.phone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("clients.col.joined"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatClinicDate(row.original.createdAt, dateFormat)}
        </span>
      ),
    },
    {
      id: "lastBooking",
      accessorFn: (row) => row.lastBooking?.date ?? "",
      header: t("clients.col.lastBooking"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const dateA = a.original.lastBooking?.date ? new Date(a.original.lastBooking.date).getTime() : 0
        const dateB = b.original.lastBooking?.date ? new Date(b.original.lastBooking.date).getTime() : 0
        return dateA - dateB
      },
      cell: ({ row }) => {
        const b = row.original.lastBooking
        if (!b) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatClinicDate(b.date, dateFormat)}
          </span>
        )
      },
    },
    {
      id: "nextBooking",
      accessorFn: (row) => row.nextBooking?.date ?? "",
      header: t("clients.col.nextBooking"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const dateA = a.original.nextBooking?.date ? new Date(a.original.nextBooking.date).getTime() : 0
        const dateB = b.original.nextBooking?.date ? new Date(b.original.nextBooking.date).getTime() : 0
        return dateA - dateB
      },
      cell: ({ row }) => {
        const b = row.original.nextBooking
        if (!b) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatClinicDate(b.date, dateFormat)}
          </span>
        )
      },
    },
    {
      id: "status",
      header: t("clients.col.status"),
      enableSorting: true,
      sortingFn: (a, b) => Number(b.original.isActive) - Number(a.original.isActive),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive ? t("clients.status.active") : t("clients.status.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("clients.col.actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onViewClick(row.original)}
                aria-label={t("clients.col.view")}
                className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={ViewIcon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("clients.col.view")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEditClick(row.original)}
                aria-label={t("clients.col.edit")}
                className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("clients.col.edit")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggleActive(row.original)}
                aria-label={row.original.isActive ? t("clients.actions.deactivate") : t("clients.actions.activate")}
                className={`flex size-9 items-center justify-center rounded-sm border border-transparent transition-all duration-200 hover:border-border hover:bg-muted ${
                  row.original.isActive
                    ? "text-destructive hover:text-destructive"
                    : "text-success hover:text-success"
                }`}
              >
                <HugeiconsIcon
                  icon={row.original.isActive ? UserBlock01Icon : UserCheck01Icon}
                  size={16}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {row.original.isActive ? t("clients.actions.deactivate") : t("clients.actions.activate")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDeleteClick(row.original)}
                aria-label={t("clients.actions.delete")}
                data-testid={`delete-client-${row.original.id}`}
                className="flex size-9 items-center justify-center rounded-sm border border-transparent text-destructive transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/10"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("clients.actions.delete")}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]
}
