"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ErrorBanner } from "@/components/features/error-banner"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { DeleteUserDialog } from "@/components/features/users/delete-user-dialog"
import { ActiveBadge } from "@/components/features/status-badge"
import { useUser } from "@/hooks/use-users"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { ApiError } from "@/lib/api"
import { Button } from "@sawaa/ui"
import { Card, CardContent } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Avatar, AvatarFallback, AvatarImage } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { formatUserRole } from "@/components/features/users/user-columns"
import type { User } from "@/lib/types/user"

/* ─── Props ─── */

interface Props {
  userId: string
}

/* ─── Component ─── */

export function UserDetailPage({ userId }: Props) {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const { formatDate } = useOrganizationConfig()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: user, isLoading, error, refetch } = useUser(userId)

  if (isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-32 w-full rounded-xl" />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={`sk-${i}`} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  const isNotFound =
    (error instanceof ApiError && error.status === 404) || (!error && !user)

  if (!isNotFound && error) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner message={t("error.server")} onRetry={() => refetch()} />
        <Button variant="outline" onClick={() => router.push("/users")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("users.detail.backToUsers")}
        </Button>
      </ListPageShell>
    )
  }

  if (error || !user) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner message={t("users.detail.notFound")} />
        <Button variant="outline" onClick={() => router.push("/users")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("users.detail.backToUsers")}
        </Button>
      </ListPageShell>
    )
  }

  const u: User = user
  const initials = (u.name ?? "").slice(0, 2).toUpperCase() || "U"

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("users.detail.home"), href: "/" },
          { label: t("nav.users"), href: "/users" },
          { label: u.name },
        ]}
      />

      <PageHeader title={u.name} description={u.email}>
        {canDo("user", "update") && (
          <Button
            className="gap-2 rounded-lg px-5"
            onClick={() => router.push(`/users/${userId}/edit`)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            {t("users.col.edit")}
          </Button>
        )}
        {canDo("user", "delete") && (
          <Button
            variant="outline"
            className="gap-2 rounded-lg px-5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
            {t("users.col.delete")}
          </Button>
        )}
      </PageHeader>

      {/* Hero Card */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="size-16 shrink-0 text-lg font-semibold">
            {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-foreground">{u.name}</h2>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {formatUserRole(u.role, t, locale)}
              </Badge>
              <ActiveBadge
                active={u.isActive}
                label={u.isActive ? t("users.status.active") : t("users.status.inactive")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title={t("users.detail.personalInfo")}>
          <DetailRow label={t("users.detail.fullName")} value={u.name} />
          <DetailRow
            label={t("users.detail.email")}
            value={u.email ? <span dir="ltr">{u.email}</span> : "—"}
          />
          <DetailRow
            label={t("users.detail.phone")}
            value={<span dir="ltr">{u.phone ?? "—"}</span>}
          />
          <DetailRow
            label={t("users.detail.gender")}
            value={u.gender ? t(u.gender === "MALE" ? "users.create.male" : "users.create.female") : "—"}
          />
        </DetailSection>

        <DetailSection title={t("users.detail.accountInfo")}>
          <DetailRow
            label={t("users.detail.role")}
            value={formatUserRole(u.role, t, locale)}
          />
          <DetailRow
            label={t("users.detail.customRole")}
            value={u.customRoleId ?? "—"}
          />
          <DetailRow
            label={t("users.detail.status")}
            value={u.isActive ? t("users.status.active") : t("users.status.inactive")}
          />
          <DetailRow
            label={t("users.detail.registered")}
            value={formatDate(u.createdAt)}
            numeric
          />
          <DetailRow
            label={t("users.detail.lastUpdated")}
            value={formatDate(u.updatedAt)}
            numeric
          />
        </DetailSection>
      </div>

      <DeleteUserDialog
        user={u}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/users")}
      />
    </ListPageShell>
  )
}