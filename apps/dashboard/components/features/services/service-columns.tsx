"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"

import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { Service } from "@/lib/types/service"
import { ServiceAvatar } from "./service-avatar"

type TFn = (key: string) => string

/* ── Actions cell ── */
function ServiceActionsCell({
  service,
  locale,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  service: Service
  locale: "en" | "ar"
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  t?: TFn
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const label = (key: string, fallback: string) => t?.(key) ?? fallback
  const displayName = (locale === "ar" ? service.nameAr : service.nameEn) ?? service.nameAr

  const btnBase =
    "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btnBase} aria-label={label("services.action.view", "View")} onClick={onView}>
              <HugeiconsIcon icon={ViewIcon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{label("services.action.view", "View")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btnBase} aria-label={label("services.action.edit", "Edit")} onClick={onEdit}>
              <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{label("services.action.edit", "Edit")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(btnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
              aria-label={label("services.action.delete", "Delete")}
              onClick={() => setDeleteOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{label("services.action.delete", "Delete")}</TooltipContent>
        </Tooltip>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label("services.delete.title", "Delete Service")}</AlertDialogTitle>
            <AlertDialogDescription>
              {label("services.delete.confirmPrefix", "Are you sure you want to delete")}{" "}
              <span className="font-semibold text-foreground">“{displayName}”</span>
              {label("services.delete.confirmSuffix", "? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{label("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setDeleteOpen(false); onDelete() }}
            >
              {label("services.action.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ── Column definitions ── */
export function getServiceColumns(
  locale: "en" | "ar" = "en",
  onEdit?: (s: Service) => void,
  onDelete?: (s: Service) => void,
  onRowClick?: (s: Service) => void,
  t?: TFn,
): ColumnDef<Service>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      accessorFn: (row) => row.nameAr || row.nameEn,
      header: label("services.col.service", "Service"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const nameA = (locale === "ar" ? a.original.nameAr : a.original.nameEn) ?? ""
        const nameB = (locale === "ar" ? b.original.nameAr : b.original.nameEn) ?? ""
        return nameA.localeCompare(nameB, locale === "ar" ? "ar" : "en")
      },
      cell: ({ row }) => {
        const s = row.original
        return (
          <button type="button" onClick={() => onRowClick?.(s)} className="text-start flex items-center gap-2">
            <ServiceAvatar
              iconName={s.iconName}
              iconBgColor={s.iconBgColor}
              imageUrl={s.imageUrl}
              name={locale === "ar" ? s.nameAr : (s.nameEn ?? undefined)}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {locale === "ar" ? s.nameAr : s.nameEn}
              </p>
              {(locale === "ar" ? s.descriptionAr : s.descriptionEn) && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {locale === "ar" ? s.descriptionAr : s.descriptionEn}
                </p>
              )}
            </div>
          </button>
        )
      },
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.nameAr || row.category?.nameEn || "",
      header: label("services.col.category", "Category"),
      enableSorting: true,
      sortingFn: (a, b) => {
        const nameA = locale === "ar" ? (a.original.category?.nameAr ?? "") : (a.original.category?.nameEn ?? "")
        const nameB = locale === "ar" ? (b.original.category?.nameAr ?? "") : (b.original.category?.nameEn ?? "")
        return nameA.localeCompare(nameB, locale === "ar" ? "ar" : "en")
      },
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.category
            ? locale === "ar"
              ? row.original.category.nameAr
              : row.original.category.nameEn
            : <span className="text-muted-foreground">&mdash;</span>}
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: label("services.col.price", "Price (SAR)"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {(row.original.price / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "durationMins",
      header: label("services.col.duration", "Duration"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.durationMins} {label("services.detail.min", "min")}
        </span>
      ),
    },
    {
      id: "status",
      header: label("services.col.status", "Status"),
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
          {row.original.isActive
            ? label("services.status.active", "Active")
            : label("services.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: label("services.col.actions", "Actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        return (
          <ServiceActionsCell
            service={s}
            locale={locale}
            onView={() => onRowClick?.(s)}
            onEdit={() => onEdit?.(s)}
            onDelete={() => onDelete?.(s)}
            t={t}
          />
        )
      },
    },
  ]
}
