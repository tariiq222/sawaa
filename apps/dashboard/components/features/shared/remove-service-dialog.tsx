"use client"

import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"

/* ─── Props ─── */

/**
 * The dialog only reads the assignment id (mutation key), the service name
 * (title) and nothing else. Callers pass either a full `EmployeeService` or a
 * synthetic row, so the prop is scoped to those two fields.
 */
export interface RemoveServiceDialogTarget {
  serviceId: string
  service: { nameAr: string; nameEn: string | null } | null
}

interface RemoveServiceDialogProps {
  employeeId: string
  employeeService: RemoveServiceDialogTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function RemoveServiceDialog({
  employeeId,
  employeeService: ps,
  open,
  onOpenChange,
}: RemoveServiceDialogProps) {
  const { locale, t } = useLocale()
  const { removeMut } = useEmployeeServiceMutations(employeeId)

  const serviceName = ps?.service
    ? locale === "ar"
      ? ps.service.nameAr
      : ps.service.nameEn
    : ""

  const handleRemove = async () => {
    if (!ps) return
    try {
      await removeMut.mutateAsync(ps.serviceId)
      toast.success(t("employees.services.removeSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove service"
      )
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("employees.services.remove")} — {serviceName}
          </AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            <span>{t("employees.services.removeConfirm")}</span>
            <span className="text-xs text-muted-foreground">
              {t("employees.services.removeWarning")}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMut.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeMut.isPending}
            className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
          >
            {removeMut.isPending
              ? t("employees.services.saving")
              : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
