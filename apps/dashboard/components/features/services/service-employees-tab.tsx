"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useServiceEmployees } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { AssignEmployeesDialog } from "@/components/features/services/assign-employees-dialog"
import { AssignedEmployeeRow } from "@/components/features/services/assigned-employee-row"
import { FormSection } from "@/components/features/shared/form-section"
import { PendingEmployeeRow } from "@/components/features/services/pending-employee-row"
import { useQuery } from "@tanstack/react-query"
import { fetchEmployees } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"

interface Props {
  serviceId?: string
  isCreate?: boolean
  pendingIds?: string[]
  onPendingChange?: (ids: string[]) => void
  serviceNameAr?: string
  serviceNameEn?: string
  pendingActive?: Record<string, boolean>
  onPendingActiveChange?: (active: Record<string, boolean>) => void
}

export function ServiceEmployeesTab({ serviceId, isCreate, pendingIds = [], onPendingChange, pendingActive = {}, onPendingActiveChange }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const [dialogOpen, setDialogOpen] = useState(false)

  /* ── Edit mode: fetch assigned employees ── */
  const { data: employees, isLoading } = useServiceEmployees(isCreate ? "" : (serviceId ?? ""))

  /* ── Create mode: fetch all employees to resolve pending names ── */
  const { data: allEmployeesData } = useQuery({
    queryKey: queryKeys.employees.list({ perPage: 200, isActive: undefined }),
    queryFn: () => fetchEmployees({ perPage: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!isCreate,
  })
  const allEmployees = allEmployeesData?.items ?? []
  const pendingEmployees = allEmployees.filter((p) => pendingIds.includes(p.id))

  /* ── Edit mode helpers ── */
  const assignedEmployeeIds = employees?.map((p) => p.employee.id) ?? []

  /* ── Create mode handlers ── */
  const handleCreateAssign = (ids: string[]) => {
    onPendingChange?.([...pendingIds, ...ids])
  }

  const handleRemovePending = (id: string) => {
    onPendingChange?.(pendingIds.filter((x) => x !== id))
  }

  /* ── Loading (edit only) ── */
  if (!isCreate && isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  /* ── Create mode ── */
  if (isCreate) {
    return (
      <FormSection>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-5">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("services.tabs.employees")}</p>
            <p className="text-xs text-muted-foreground">{t("services.employees.editHint")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
              {`${pendingEmployees.length} ${t("services.employees.countLabel")}`}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
              {t("services.employees.add")}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {pendingEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("services.employees.emptyTitle")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-stretch">
              {pendingEmployees.map((p) => (
                <PendingEmployeeRow
                  key={p.id}
                  employee={p}
                  isActive={pendingActive[p.id] ?? true}
                  onActiveChange={(next) =>
                    onPendingActiveChange?.({ ...pendingActive, [p.id]: next })
                  }
                  onRemove={() => handleRemovePending(p.id)}
                />
              ))}
            </div>
          )}

          <AssignEmployeesDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            serviceId=""
            excludeIds={pendingIds}
            createMode
            onCreateAssign={handleCreateAssign}
          />
        </div>
      </FormSection>
    )
  }

  /* ── Edit mode ── */
  return (
    <FormSection>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-5">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("services.tabs.employees")}</p>
          <p className="text-xs text-muted-foreground">{t("services.employees.editHint")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
            {`${employees?.length ?? 0} ${t("services.employees.countLabel")}`}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
            {t("services.employees.add")}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {!employees || employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("services.employees.emptyTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("services.employees.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-stretch">
            {employees.map((item) => (
              <AssignedEmployeeRow
                key={item.id}
                item={item}
                serviceId={serviceId ?? ""}
                isAr={isAr}
                t={t}
                onView={() => router.push(`/employees/${item.employee.id}/edit`)}
              />
            ))}
          </div>
        )}

        <AssignEmployeesDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          serviceId={serviceId ?? ""}
          excludeIds={assignedEmployeeIds}
        />
      </div>
    </FormSection>
  )
}
