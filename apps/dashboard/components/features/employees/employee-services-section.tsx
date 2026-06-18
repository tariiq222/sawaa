"use client"

import { useState } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useEmployeeServices } from "@/hooks/use-employees"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import { AssignServiceSheet } from "./assign-service-sheet"
import { EditEmployeeServiceSheet } from "./edit-employee-service-sheet"
import { RemoveServiceDialog } from "./remove-service-dialog"
import { EmployeeServiceRow } from "./employee-service-row"
import type { EmployeeService, UpdateServicePayload } from "@/lib/types/employee"

/* ─── Props ─── */

interface Props {
  employeeId: string
}

/* ─── Component ─── */

export function EmployeeServicesSection({ employeeId }: Props) {
  const { locale, t } = useLocale()
  const { data: services, isLoading } = useEmployeeServices(employeeId)
  const { updateMut } = useEmployeeServiceMutations(employeeId)

  const [assignOpen, setAssignOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EmployeeService | null>(null)
  const [removeTarget, setRemoveTarget] = useState<EmployeeService | null>(null)

  /* Per-row patch helper */
  const patchAssignment = (
    serviceId: string,
    patch: UpdateServicePayload,
    onSettled?: () => void,
  ) => {
    updateMut.mutate(
      { serviceId, payload: patch },
      {
        onSettled,
        onError: () => toast.error(t("employees.services.inlineUpdateError")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("employees.services.title")}
          {services && services.length > 0 && ` (${services.length})`}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setAssignOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          {t("employees.services.assign")}
        </Button>
      </div>

      {/* Empty State */}
      {(!services || services.length === 0) && (
        <p className="text-sm text-muted-foreground">
          {t("employees.services.noServices")}
        </p>
      )}

      {/* Service List */}
      {services?.map((ps) => (
        <EmployeeServiceRow
          key={ps.id}
          ps={ps}
          locale={locale}
          t={t}
          isSaving={
            updateMut.isPending &&
            updateMut.variables?.serviceId === ps.serviceId
          }
          onPatchBuffer={(next, onSettled) =>
            patchAssignment(ps.serviceId, { bufferMinutes: next }, onSettled)
          }
          onPatchActive={(next, onSettled) =>
            patchAssignment(ps.serviceId, { isActive: next }, onSettled)
          }
          onEdit={() => setEditTarget(ps)}
          onRemove={() => setRemoveTarget(ps)}
        />
      ))}

      {/* Sheets & Dialogs */}
      <AssignServiceSheet
        employeeId={employeeId}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      <EditEmployeeServiceSheet
        employeeId={employeeId}
        employeeService={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      />
      <RemoveServiceDialog
        employeeId={employeeId}
        employeeService={removeTarget}
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      />
    </div>
  )
}
