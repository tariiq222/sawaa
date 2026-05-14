"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { formatClinicDate } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"
import {
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Delete02Icon,
  UserCheck01Icon,
  UserBlock01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deqah/ui"
import type { User } from "@/lib/types/user"
import type { Locale } from "@/lib/translations"
import type { UserRole } from "@/lib/types/user"

interface UserColumnCallbacks {
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  onToggleActive: (user: User) => void
}

export function getUserColumns(
  callbacks?: UserColumnCallbacks,
  t: (key: string) => string = (k) => k,
  locale: Locale = "ar",
  config?: { dateFormat?: DateFormat },
): ColumnDef<User>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const columns: ColumnDef<User>[] = [
    {
      id: "user",
      header: t("users.col.user"),
      cell: ({ row }) => {
        const u = row.original
        const initials = (u.name ?? "").slice(0, 2).toUpperCase() || "U"
        return (
          <div className="flex items-center gap-4">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: "role",
      header: t("users.col.roles"),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-[10px]">
          {formatUserRole(row.original.role, t, locale)}
        </Badge>
      ),
    },
    {
      accessorKey: "phone",
      header: t("users.col.phone"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.phone ?? "\u2014"}
        </span>
      ),
    },
    {
      id: "status",
      header: t("users.col.status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive ? t("users.status.active") : t("users.status.inactive")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("users.col.joined"),
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
        const user = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">{t("users.col.actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => callbacks.onEdit(user)}>
                <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                {t("users.col.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => callbacks.onToggleActive(user)}
              >
                <HugeiconsIcon
                  icon={user.isActive ? UserBlock01Icon : UserCheck01Icon}
                  size={14}
                />
                {user.isActive ? t("users.col.deactivate") : t("users.col.activate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => callbacks.onDelete(user)}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {t("users.col.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return columns
}

const USER_ROLE_FALLBACKS: Record<Locale, Record<UserRole, string>> = {
  ar: {
    SUPER_ADMIN: "مدير المنصة",
    ADMIN: "مدير",
    RECEPTIONIST: "موظف استقبال",
    ACCOUNTANT: "محاسب",
    EMPLOYEE: "موظف",
    CLIENT: "مستفيد",
  },
  en: {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    RECEPTIONIST: "Receptionist",
    ACCOUNTANT: "Accountant",
    EMPLOYEE: "Employee",
    CLIENT: "Client",
  },
}

export function formatUserRole(
  role: UserRole,
  t: (key: string) => string,
  locale: Locale,
) {
  const key = `users.role.${role}`
  const label = t(key)
  return label === key ? USER_ROLE_FALLBACKS[locale][role] : label
}
