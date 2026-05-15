"use client"

import { useState } from "react"
import {
  DocumentAttachmentIcon,
  CheckmarkCircle02Icon,
  TimeQuarterPassIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { FilterBar } from "@/components/features/filter-bar"
import { DataTable } from "@/components/features/data-table"
import { getInvoiceColumns } from "@/components/features/invoices/invoice-columns"
import { Skeleton } from "@sawaa/ui"
import { useInvoices } from "@/hooks/use-invoices"
import { useLocale } from "@/components/locale-provider"

export function InvoiceListPage() {
  const { t } = useLocale()
  const { payments, isLoading, error, search, setSearch } = useInvoices()

  const hasFilters = search !== ""
  const resetFilters = () => {
    setSearch("")
  }

  const columns = getInvoiceColumns(undefined, t)

  const completed = payments.filter((p) => p.status === "COMPLETED").length
  const pending = payments.filter((p) => p.status === "PENDING" || p.status === "PENDING_VERIFICATION").length
  const failed = payments.filter((p) => p.status === "FAILED").length

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid>
          <StatCard
            title={t("invoices.stats.total")}
            value={payments.length}
            icon={DocumentAttachmentIcon}
            iconColor="primary"
          />
          <StatCard
            title={t("invoices.stats.accepted")}
            value={completed}
            icon={CheckmarkCircle02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("invoices.stats.pending")}
            value={pending}
            icon={TimeQuarterPassIcon}
            iconColor="warning"
          />
          <StatCard
            title={t("invoices.stats.rejected")}
            value={failed}
            icon={Cancel01Icon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("invoices.searchPlaceholder"),
        }}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={payments as never[]}
          emptyTitle={t("invoices.empty.title")}
          emptyDescription={t("invoices.empty.description")}
        />
      )}
    </ListPageShell>
  )
}
