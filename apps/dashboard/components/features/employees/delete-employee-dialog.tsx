"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { deleteEmployee } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"
import type { Employee } from "@/lib/types/employee"

interface DeleteEmployeeDialogProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: DeleteEmployeeDialogProps) {
  const { t } = useLocale()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.stats() })
      toast.success(t("employees.delete.success"))
      onOpenChange(false)
    },
    onError: () => {
      toast.error(t("employees.delete.error"))
    },
  })

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!employee) return
    mutation.mutate(employee.id)
  }

  const name = employee
    ? `${employee.user.firstName} ${employee.user.lastName}`
    : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("employees.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("employees.delete.descriptionPrefix")}{" "}
            <strong>{name}</strong>
            {t("employees.delete.descriptionSuffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t("employees.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending
              ? t("employees.delete.submitting")
              : t("employees.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
