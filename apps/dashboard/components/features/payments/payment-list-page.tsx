"use client"

import { useState, useCallback } from "react"
import { MoneyBag02Icon, TimeQuarterPassIcon, CheckmarkCircle02Icon, ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { ErrorBanner } from "@/components/features/error-banner"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { getPaymentColumns } from "@/components/features/payments/payment-columns"
import { PaymentDetailSheet } from "@/components/features/payments/payment-detail-sheet"
import { FilterBar } from "@/components/features/filter-bar"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Skeleton } from "@sawaa/ui"
import { usePayments, usePaymentStats } from "@/hooks/use-payments"
import { useLocale } from "@/components/locale-provider"
import type { Payment } from "@/lib/types/payment"

export function PaymentListPage() {
  const { t, locale } = useLocale()
  const { payments, isLoading, error, search, setSearch, status, setStatus, method, setMethod, hasFilters, resetFilters, refetch } = usePayments()
  const { data: stats, isLoading: statsLoading } = usePaymentStats()

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleView = useCallback((payment: Payment) => { setSelectedPaymentId(payment.id); setSheetOpen(true) }, [])
  const handleAction = useCallback(() => { refetch(); setSheetOpen(false) }, [refetch])

  const columns = getPaymentColumns({ onView: handleView, onRefund: handleView }, t)

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("payments.title")}
        description={t("payments.description")}
      />

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
        </div>
      ) : stats ? (
        <StatsGrid>
          <StatCard title={t("payments.stats.total")} value={<FormattedCurrency amount={stats.totalAmount ?? 0} locale={locale} />} description={`${stats.total ?? 0} ${t("payments.stats.transactions")}`} icon={MoneyBag02Icon} iconColor="primary" />
          <StatCard title={t("payments.stats.pending")} value={stats.pending ?? 0} description={<FormattedCurrency amount={stats.pendingAmount ?? 0} locale={locale} />} icon={TimeQuarterPassIcon} iconColor="warning" />
          <StatCard title={t("payments.stats.paid")} value={stats.completed ?? 0} description={<FormattedCurrency amount={stats.completedAmount ?? 0} locale={locale} />} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("payments.stats.refunded")} value={stats.refunded ?? 0} description={<FormattedCurrency amount={stats.refundedAmount ?? 0} locale={locale} />} icon={ArrowTurnBackwardIcon} iconColor="warning" />
        </StatsGrid>
      ) : null}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("payments.searchPlaceholder") }}
        selects={[
          { key: "status", value: status, placeholder: t("payments.filters.status"), options: [{ value: "all", label: t("payments.filters.allStatuses") }, { value: "PENDING", label: t("payments.filters.pending") }, { value: "COMPLETED", label: t("payments.filters.paid") }, { value: "REFUNDED", label: t("payments.filters.refunded") }, { value: "FAILED", label: t("payments.filters.failed") }], onValueChange: (v) => setStatus(v as typeof status) },
          { key: "method", value: method, placeholder: t("payments.filters.method"), options: [{ value: "all", label: t("payments.filters.allMethods") }, { value: "ONLINE_CARD", label: "Moyasar" }, { value: "BANK_TRANSFER", label: t("payments.filters.bankTransfer") }, { value: "CASH", label: t("payments.filters.cash") }], onValueChange: (v) => setMethod(v as typeof method) },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {error && <ErrorBanner message={error} />}

      {isLoading && payments.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable columns={columns} data={payments} emptyTitle={t("payments.empty.title")} emptyDescription={t("payments.empty.description")} />
      )}

      <PaymentDetailSheet paymentId={selectedPaymentId} open={sheetOpen} onOpenChange={setSheetOpen} onAction={handleAction} />
    </ListPageShell>
  )
}
