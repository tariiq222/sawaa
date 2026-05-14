"use client"

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

interface Props {
  open: boolean
  targetStatus: boolean // true = activating, false = suspending
  employeeName: string
  onConfirm: () => void
  onCancel: () => void
}

export function EmployeeStatusDialog({
  open,
  targetStatus,
  employeeName,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLocale()

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {targetStatus
              ? t("employees.status.activateTitle")
              : t("employees.status.suspendTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {targetStatus
              ? t("employees.status.activateDesc").replace("{name}", employeeName)
              : t("employees.status.suspendDesc").replace("{name}", employeeName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              targetStatus
                ? ""
                : "bg-destructive text-white hover:bg-destructive/90"
            }
          >
            {targetStatus
              ? t("employees.status.confirmActivate")
              : t("employees.status.confirmSuspend")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
