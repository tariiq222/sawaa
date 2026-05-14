"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, PencilEdit01Icon, Delete02Icon, CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deqah/ui"
import { ar } from "date-fns/locale"
import { formatDatePattern } from "@/lib/date"
import type { Coupon } from "@/lib/types/coupon"

type TFn = (key: string) => string

export function getCouponColumns(
  locale: "en" | "ar" = "en",
  onEdit?: (c: Coupon) => void,
  onDelete?: (c: Coupon) => void,
  t?: TFn,
  onToggleActive?: (c: Coupon) => void,
): ColumnDef<Coupon>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      accessorKey: "code",
      header: label("coupons.col.code", "Code"),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold text-foreground">
          {row.original.code}
        </span>
      ),
    },
    {
      id: "discount",
      header: label("coupons.col.discount", "Discount"),
      cell: ({ row }) => {
        const c = row.original
        return (
          <span className="tabular-nums text-sm font-medium">
            {c.discountType === "PERCENTAGE"
              ? `${c.discountValue}%`
              : `${(c.discountValue / 100).toFixed(2)} SAR`}
          </span>
        )
      },
    },
    {
      id: "usage",
      header: label("coupons.col.usage", "Usage"),
      cell: ({ row }) => {
        const c = row.original
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}
          </span>
        )
      },
    },
    {
      id: "expires",
      header: label("coupons.col.expires", "Expires"),
      cell: ({ row }) => {
        const c = row.original
        if (!c.expiresAt) {
          return <span className="text-sm text-muted-foreground">{label("coupons.noExpiry", "No expiry")}</span>
        }
        const isExpired = new Date(c.expiresAt) < new Date()
        return (
          <span className={`tabular-nums text-sm ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
            {formatDatePattern(c.expiresAt, "PP", { locale: locale === "ar" ? ar : undefined })}
          </span>
        )
      },
    },
    {
      id: "status",
      header: label("coupons.col.status", "Status"),
      cell: ({ row }) => {
        const c = row.original
        const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date()
        if (isExpired) {
          return (
            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
              {label("coupons.status.expired", "Expired")}
            </Badge>
          )
        }
        return (
          <Badge
            variant="outline"
            className={
              c.isActive
                ? "border-success/30 bg-success/10 text-success"
                : "border-muted-foreground/30 bg-muted text-muted-foreground"
            }
          >
            {c.isActive
              ? label("coupons.status.active", "Active")
              : label("coupons.status.inactive", "Inactive")}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original
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
              <DropdownMenuItem onClick={() => onEdit?.(c)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("coupons.action.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive?.(c)}>
                <HugeiconsIcon icon={c.isActive ? Cancel01Icon : CheckmarkCircle02Icon} size={14} />
                {label(
                  c.isActive ? "coupons.action.deactivate" : "coupons.action.activate",
                  c.isActive ? "Deactivate" : "Activate",
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(c)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {label("coupons.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
