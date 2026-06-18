"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@sawaa/ui"
import { useServiceEmployees } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { AssignEmployeesDialog } from "@/components/features/services/assign-employees-dialog"
import { EditEmployeeServiceSheet } from "@/components/features/employees/edit-employee-service-sheet"
import { AssignedEmployeeRow } from "@/components/features/services/assigned-employee-row"
import { useQuery } from "@tanstack/react-query"
import { fetchEmployees } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"
import type { ServiceEmployee } from "@/lib/types/service"
import type { EmployeeService } from "@/lib/types/employee"

interface Props {
  serviceId?: string
  isCreate?: boolean
  pendingIds?: string[]
  onPendingChange?: (ids: string[]) => void
  serviceNameAr?: string
  serviceNameEn?: string
}

export function ServiceEmployeesTab({ serviceId, isCreate, pendingIds = [], onPendingChange, serviceNameAr, serviceNameEn }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceEmployee | null>(null)

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

  function buildEmployeeService(item: ServiceEmployee): EmployeeService {
    return {
      id: item.id,
      serviceId: serviceId ?? "",
      bufferMinutes: item.bufferMinutes,
      isActive: item.isActive,
      availableTypes: item.availableTypes,
      service: {
        id: serviceId ?? "",
        nameAr: serviceNameAr ?? "",
        nameEn: serviceNameEn ?? "",
        price: 0,
        duration: 0,
      },
      serviceTypes: [],
    }
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
      <div className="space-y-4">
        {pendingEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("services.employees.emptyTitle")}
            </p>
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
        ) : (
          <div className="space-y-3">
            {pendingEmployees.map((p) => {
              const fullName = `${p.user.firstName} ${p.user.lastName}`
              const displayName = isAr && p.nameAr ? p.nameAr : fullName
              return (
                <SurfaceRow
                  key={p.id}
                  variant="default"
                  size="md"
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                      <div className="flex size-full items-center justify-center">
                        <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                      {p.specialty && (
                        <span className="text-xs text-muted-foreground">
                          {isAr ? (p.specialtyAr || p.specialty) : p.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-error"
                    onClick={() => handleRemovePending(p.id)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                  </Button>
                </SurfaceRow>
              )
            })}
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
    )
  }

  /* ── Edit mode ── */
  return (
    <Card className="border-s-2 border-s-primary/40">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1 min-w-0">
            <CardTitle>{t("services.tabs.employees")}</CardTitle>
            <CardDescription>
              {t("services.employees.editHint")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
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
      </CardHeader>

      <CardContent className="space-y-3">
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
                onEdit={() => setEditing(item)}
                onView={() => router.push(`/employees/${item.employee.id}/edit`)}
              />
            ))}
          </div>
        )}

        {/* note: useServiceEmployees list isn't force-refreshed after sheet saves — rows show no price so stale data is not visible */}
        <EditEmployeeServiceSheet
          employeeId={editing?.employee.id ?? ""}
          employeeService={editing ? buildEmployeeService(editing) : null}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null) }}
        />

        <AssignEmployeesDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          serviceId={serviceId ?? ""}
          excludeIds={assignedEmployeeIds}
        />
      </CardContent>
    </Card>
  )
}
