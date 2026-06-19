"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { DataTable } from "@/components/features/data-table"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { getClientColumns } from "@/components/features/clients/client-columns"
import { DeleteClientDialog } from "@/components/features/clients/delete-client-dialog"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useClients, useClientMutations } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { Client } from "@/lib/types/client"

export function ClientListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const titleLabel = t("nav.clients")
  const { clients, meta, isLoading, error, search, setSearch, isActive, setIsActive, resetSearch, page, setPage } = useClients()
  const { toggleActiveMut } = useClientMutations()

  const [pendingDelete, setPendingDelete] = useState<Client | null>(null)

  const hasFilters = isActive !== undefined || search.length > 0

  const columns = getClientColumns({
    onRowClick: (p) => router.push(`/clients/${p.id}`),
    onViewClick: (p) => router.push(`/clients/${p.id}`),
    onEditClick: canDo("client", "update") ? (p) => router.push(`/clients/${p.id}/edit`) : undefined,
    onToggleActive: canDo("client", "update") ? (p) => {
      toggleActiveMut.mutate(
        { id: p.id, isActive: !p.isActive },
        {
          onSuccess: () =>
            toast.success(p.isActive ? t("clients.deactivated") : t("clients.activated")),
          onError: () =>
            toast.error(p.isActive ? t("clients.deactivateError") : t("clients.activateError")),
        },
      )
    } : undefined,
    onDeleteClick: canDo("client", "delete") ? (p) => setPendingDelete(p) : undefined,
    t,
    locale,
  })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={titleLabel}
        description={t("clients.description")}
      >
        {canDo("Client", "create") && (
          <Button className="gap-2 rounded-lg px-5" onClick={() => router.push("/clients/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("clients.addClient")}
          </Button>
        )}
      </PageHeader>

      {error && <ErrorBanner message={error} />}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("clients.searchPlaceholder") }}
        hasFilters={hasFilters}
        onReset={() => { resetSearch(); setIsActive(undefined) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("clients.stats.total")}` : undefined}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("clients.filter.allStatuses"),
            options: [
              { value: "all", label: t("clients.filter.allStatuses") },
              { value: "active", label: t("clients.status.active") },
              { value: "inactive", label: t("clients.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
      />

      {isLoading && clients.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={clients}
          emptyTitle={hasFilters ? t("clients.empty.noMatches.title") : t("clients.empty.title")}
          emptyDescription={hasFilters ? t("clients.empty.noMatches.description") : t("clients.empty.description")}
          emptyAction={
            hasFilters
              ? { label: t("clients.filters.reset"), onClick: () => { resetSearch(); setIsActive(undefined) } }
              : canDo("Client", "create")
                ? { label: t("clients.addClient"), onClick: () => router.push("/clients/create") }
                : undefined
          }
          serverPaginated
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          hasPreviousPage={meta?.hasPreviousPage ?? false}
          hasNextPage={meta?.hasNextPage ?? false}
          onPageChange={setPage}
        />
      )}

      <DeleteClientDialog
        client={pendingDelete}
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
      />
    </ListPageShell>
  )
}
