"use client"

import { Button } from "@sawaa/ui"

interface ServiceFormActionsProps {
  cancelLabel: string
  submitLabel: string
  isSubmitting: boolean
  isSubmitBlocked: boolean
  onCancel: () => void
}

export function ServiceFormActions({ cancelLabel, submitLabel, isSubmitting, isSubmitBlocked, onCancel }: ServiceFormActionsProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" size="lg" className="rounded-lg" disabled={isSubmitting || isSubmitBlocked}>
        {submitLabel}
      </Button>
    </div>
  )
}
