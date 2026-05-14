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
import { useLocale } from "@/components/locale-provider"

export function InvoiceListPage() {
  const { t } = useLocale()

  const [search, setSearch] = useState("")

  const hasFilters = search !== ""
  const resetFilters = () => {
    setSearch("")
  }

  const columns = getInvoiceColumns(undefined, t)

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
      />

      <StatsGrid>
        <StatCard
          title={t("invoices.stats.total")}
          value={0}
          icon={DocumentAttachmentIcon}
          iconColor="primary"
        />
        <StatCard
          title={t("invoices.stats.accepted")}
          value={0}
          icon={CheckmarkCircle02Icon}
          iconColor="success"
        />
        <StatCard
          title={t("invoices.stats.pending")}
          value={0}
          icon={TimeQuarterPassIcon}
          iconColor="warning"
        />
        <StatCard
          title={t("invoices.stats.rejected")}
          value={0}
          icon={Cancel01Icon}
          iconColor="accent"
        />
      </StatsGrid>

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("invoices.searchPlaceholder"),
        }}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      <DataTable
        columns={columns}
        data={[]}
        emptyTitle={t("invoices.empty.title")}
        emptyDescription={t("invoices.empty.description")}
      />
    </ListPageShell>
  )
}
