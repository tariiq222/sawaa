"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Controller } from "react-hook-form"
import { Button } from "@sawaa/ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { DatePicker } from "@/components/ui/date-picker"
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
import {
  useEmployeeVacations,
  useVacationMutations,
} from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { formatDatePattern } from "@/lib/date"

/* ─── Types ─── */

type VacationFormData = {
  startDate: string
  endDate: string
  reason?: string
}

/* ─── Props ─── */

interface VacationManagerProps {
  employeeId: string
}

/* ─── Component ─── */

export function VacationManager({ employeeId }: VacationManagerProps) {
  const { t } = useLocale()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: vacations, isLoading } =
    useEmployeeVacations(employeeId)
  const { createMut, deleteMut } = useVacationMutations(employeeId)

  const vacationSchema = useMemo(
    () =>
      z
        .object({
          startDate: z.string().min(1, t("vacation.validation.startRequired")),
          endDate: z.string().min(1, t("vacation.validation.endRequired")),
          reason: z.string().optional(),
        })
        .refine((d) => d.startDate <= d.endDate, {
          message: t("vacation.validation.endAfterStart"),
          path: ["endDate"],
        }),
    [t],
  )

  const form = useForm<VacationFormData>({
    resolver: zodResolver(vacationSchema),
    defaultValues: { startDate: "", endDate: "", reason: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || undefined,
      })
      toast.success(t("vacation.addSuccess"))
      form.reset()
      setAddOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("vacation.addError"),
      )
    }
  })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteMut.mutateAsync(deleteId)
      toast.success(t("vacation.deleteSuccess"))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("vacation.deleteError"),
      )
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("vacation.title")}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAddOpen(true)}
        >
          {t("vacation.add")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : !vacations || vacations.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("vacation.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {vacations.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-md border border-border p-2"
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {formatDatePattern(v.startDate, "MMM d, yyyy")} &mdash;{" "}
                  {formatDatePattern(v.endDate, "MMM d, yyyy")}
                </span>
                {v.reason && (
                  <span className="text-xs text-muted-foreground">
                    {v.reason}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => setDeleteId(v.id)}
              >
                {t("vacation.delete")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Vacation Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>{t("vacation.addTitle")}</SheetTitle>
            <SheetDescription>
              {t("vacation.addDescription")}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <form id="add-vacation-form" onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>{t("vacation.startDate")}</Label>
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      minDate={new Date().toISOString().split("T")[0]}
                      error={!!form.formState.errors.startDate}
                      required
                      suppressHydrationWarning
                    />
                  )}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("vacation.endDate")}</Label>
                <Controller
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      minDate={form.watch("startDate") || new Date().toISOString().split("T")[0]}
                      error={!!form.formState.errors.endDate}
                      required
                      suppressHydrationWarning
                    />
                  )}
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("vacation.reason")}</Label>
                <Textarea {...form.register("reason")} rows={2} />
              </div>
            </form>
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              {t("vacation.cancel")}
            </Button>
            <Button type="submit" form="add-vacation-form" disabled={createMut.isPending}>
              {createMut.isPending ? t("vacation.submitting") : t("vacation.submit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vacation.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vacation.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("vacation.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? t("vacation.deleting") : t("vacation.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
