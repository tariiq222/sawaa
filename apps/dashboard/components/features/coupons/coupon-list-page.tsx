"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Coupon01Icon, CheckmarkCircle02Icon, Cancel01Icon, PercentCircleIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { getCouponColumns } from "@/components/features/coupons/coupon-columns"
import { DeleteCouponDialog } from "@/components/features/coupons/delete-coupon-dialog"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { FilterBar } from "@/components/features/filter-bar"
import { useCoupons, useCouponMutations } from "@/hooks/use-coupons"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { Coupon } from "@/lib/types/coupon"

export function CouponListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const { coupons, meta, isLoading, error, search, setSearch, status, setStatus, page, setPage } = useCoupons()

  const { updateMut } = useCouponMutations()

  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)

  const now = new Date()
  const activeCount = coupons.filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > now)).length
  const inactiveCount = coupons.filter((c) => !c.isActive).length
  const expiredCount = coupons.filter((c) => c.expiresAt && new Date(c.expiresAt) < now).length

  const columns = getCouponColumns(
    locale,
    (c) => router.push(`/coupons/${c.id}/edit`),
    (c) => setDeleteTarget(c),
    t,
    (c) => updateMut.mutate({ id: c.id, isActive: !c.isActive }),
  )

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("coupons.title")}
        description={t("coupons.description")}
      >
        {canDo("Coupon", "create") && (
          <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/coupons/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("coupons.addCoupon")}
          </Button>
        )}
      </PageHeader>

      {isLoading && !meta ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid>
          <StatCard title={t("coupons.stats.total")} value={meta?.total ?? 0} icon={Coupon01Icon} iconColor="primary" />
          <StatCard title={t("coupons.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("coupons.stats.inactive")} value={inactiveCount} icon={Cancel01Icon} iconColor="warning" />
          <StatCard title={t("coupons.stats.expired")} value={expiredCount} icon={PercentCircleIcon} iconColor="accent" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("coupons.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: status ?? "all",
            placeholder: t("coupons.filters.allStatuses"),
            options: [
              { value: "all", label: t("coupons.filters.allStatuses") },
              { value: "active", label: t("coupons.status.active") },
              { value: "inactive", label: t("coupons.status.inactive") },
              { value: "expired", label: t("coupons.status.expired") },
            ],
            onValueChange: (v) => { setStatus(v === "all" ? undefined : v); setPage(1) },
          },
        ]}
        hasFilters={search.length > 0 || !!status}
        onReset={() => { setSearch(""); setStatus(undefined); setPage(1) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("coupons.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {isLoading && coupons.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable columns={columns} data={coupons} emptyTitle={t("coupons.empty.title")} emptyDescription={t("coupons.empty.description")} emptyAction={canDo("Coupon", "create") ? { label: t("coupons.addCoupon"), onClick: () => router.push("/coupons/create") } : undefined} />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("table.pagination.page")} {meta.page} {t("table.pagination.of")} {meta.totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPreviousPage} onClick={() => setPage(meta.page - 1)}>{t("table.pagination.previous")}</Button>
            <Button variant="outline" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage(meta.page + 1)}>{t("table.pagination.next")}</Button>
          </div>
        </div>
      )}

      <DeleteCouponDialog coupon={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
