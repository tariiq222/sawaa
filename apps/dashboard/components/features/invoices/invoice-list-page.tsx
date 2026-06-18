"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { FilterBar } from "@/components/features/filter-bar"
import { DataTable } from "@/components/features/data-table"
import { getInvoiceColumns } from "@/components/features/invoices/invoice-columns"
import { Skeleton } from "@sawaa/ui"
import { useInvoices } from "@/hooks/use-invoices"
import { useLocale } from "@/components/locale-provider"

export function InvoiceListPage() {
  const { t } = useLocale()
  const { invoices, isLoading, error: _error, search, setSearch } = useInvoices()

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
          data={invoices}
          emptyTitle={t("invoices.empty.title")}
          emptyDescription={t("invoices.empty.description")}
        />
      )}
    </ListPageShell>
  )
}
