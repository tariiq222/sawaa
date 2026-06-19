"use client"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button,
} from "@sawaa/ui"

interface CategoryWizardNavProps {
  mode: "create" | "edit"
  isFirst: boolean
  isLast: boolean
  isSubmitting: boolean
  isDirty: boolean
  exitConfirmOpen: boolean
  onNext: () => void
  onBack: () => void
  onCancel: () => void
  onFinish: () => void
  onExitConfirm: () => void
  onExitCancel: () => void
  t: (key: string) => string
}

export function CategoryWizardNav({
  mode, isFirst, isLast, isSubmitting, isDirty,
  exitConfirmOpen, onNext, onBack, onCancel, onFinish, onExitConfirm, onExitCancel, t,
}: CategoryWizardNavProps) {
  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {isFirst ? (
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={onCancel}>
            {t("services.categories.edit.cancel")}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onBack}>
            {t("services.categories.wizard.back")}
          </Button>
        )}
        {isLast ? (
          <Button type="button" size="lg" className="rounded-lg" disabled={isSubmitting} onClick={onFinish}>
            {isSubmitting ? t("services.categories.edit.submitting") : t("services.categories.wizard.finish")}
          </Button>
        ) : (
          <Button type="button" size="lg" className="rounded-lg" disabled={isSubmitting} onClick={onNext}>
            {isSubmitting
              ? (mode === "edit" ? t("services.categories.edit.submitting") : t("services.categories.create.submitting"))
              : t("services.categories.wizard.next")}
          </Button>
        )}
      </div>

      <AlertDialog open={exitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("services.categories.edit.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("services.categories.edit.unsavedDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onExitCancel}>{t("services.categories.edit.unsavedStay")}</AlertDialogCancel>
            <AlertDialogAction onClick={onExitConfirm}>{t("services.categories.edit.unsavedLeave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
