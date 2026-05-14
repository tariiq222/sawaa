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
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeServiceMutations } from "@/hooks/use-employees"
import type { EmployeeService } from "@/lib/types/employee"

/* ─── Props ─── */

interface RemoveServiceDialogProps {
  employeeId: string
  employeeService: EmployeeService | null
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

  const serviceName = ps
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
        err instanceof Error ? err.message : "Failed to remove service",
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
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
