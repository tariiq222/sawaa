"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { Button, Card, CardContent, Input, Switch, Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useDiscountReasons,
  useDiscountReasonMutations,
} from "@/hooks/use-discount-reasons"

export function DiscountReasonsManager() {
  const { t } = useLocale()
  const { data: reasons = [], isLoading } = useDiscountReasons(true)
  const { createMut, updateMut, deleteMut } = useDiscountReasonMutations()
  const [newLabel, setNewLabel] = useState("")

  async function onAdd() {
    const labelAr = newLabel.trim()
    if (!labelAr) return
    try {
      await createMut.mutateAsync({ labelAr })
      setNewLabel("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("discountReasons.errorToast"))
    }
  }

  async function onToggle(id: string, isActive: boolean) {
    try {
      await updateMut.mutateAsync({ id, isActive })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("discountReasons.errorToast"))
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("discountReasons.errorToast"))
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="new-reason" className="text-sm font-medium">
              {t("discountReasons.newLabel")}
            </label>
            <Input
              id="new-reason"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("discountReasons.newPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd()
              }}
            />
          </div>
          <Button type="button" onClick={onAdd} disabled={!newLabel.trim() || createMut.isPending}>
            <HugeiconsIcon icon={Add01Icon} size={16} className="me-1.5" />
            {t("discountReasons.add")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : reasons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("discountReasons.empty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {reasons.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm font-medium text-foreground">{r.labelAr}</span>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={r.isActive}
                    onCheckedChange={(checked) => onToggle(r.id, checked)}
                    aria-label={t("discountReasons.active")}
                  />
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    disabled={deleteMut.isPending}
                    aria-label={t("discountReasons.delete")}
                    className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
