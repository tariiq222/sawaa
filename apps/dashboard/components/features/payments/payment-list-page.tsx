"use client"

import { useState, useCallback } from "react"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { getPaymentColumns } from "@/components/features/payments/payment-columns"
import { PaymentDetailDialog } from "@/components/features/payments/payment-detail-dialog"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@sawaa/ui"
import { usePayments } from "@/hooks/use-payments"
import { useLocale } from "@/components/locale-provider"
import type { Payment } from "@/lib/types/payment"

export function PaymentListPage() {
  const { t } = useLocale()
  const { payments, meta, isLoading, error, search, setSearch, status, setStatus, method, setMethod, hasFilters, resetFilters, refetch, page, setPage } = usePayments()

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
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          emptyTitle={t("payments.empty.title")}
          emptyDescription={t("payments.empty.description")}
          serverPaginated
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          hasPreviousPage={meta?.hasPreviousPage ?? false}
          hasNextPage={meta?.hasNextPage ?? false}
          onPageChange={setPage}
        />
      )}

      <PaymentDetailDialog paymentId={selectedPaymentId} open={sheetOpen} onOpenChange={setSheetOpen} onAction={handleAction} />
    </ListPageShell>
  )
}
