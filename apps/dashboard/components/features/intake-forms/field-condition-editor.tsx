"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { FormField, ConditionOperator } from "@/lib/types/intake-form"
import { CONDITION_OPERATOR_LABELS } from "@/lib/types/intake-form"

interface FieldConditionEditorProps {
  field: FormField
  prevFields: FormField[]
  onUpdate: (patch: Partial<FormField>) => void
}

export function FieldConditionEditor({ field, prevFields, onUpdate }: FieldConditionEditorProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"

  function addCondition() {
    if (prevFields.length === 0) return
    onUpdate({
      condition: {
        fieldId: prevFields[0].id,
        operator: "equals",
        value: "",
      },
    })
  }

  function removeCondition() {
    const next = { ...field }
    delete next.condition
    onUpdate(next)
  }

  return (
    <>
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            {t("intakeForms.condition.logic")}
          </Label>
          {field.condition ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive px-2"
              onClick={removeCondition}
            >
              {t("intakeForms.condition.remove")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={addCondition}
            >
              <HugeiconsIcon icon={Add01Icon} size={12} className="me-1" />
              {t("intakeForms.condition.add")}
            </Button>
          )}
        </div>

        {field.condition && (
          <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-3">
            <Select
              value={field.condition.fieldId}
              onValueChange={(v) =>
                onUpdate({ condition: { ...field.condition!, fieldId: v } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("intakeForms.condition.field")} />
              </SelectTrigger>
              <SelectContent>
                {prevFields.map((pf) => (
                  <SelectItem key={pf.id} value={pf.id}>
                    {isAr ? pf.labelAr || pf.labelEn : pf.labelEn || pf.labelAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={field.condition.operator}
              onValueChange={(v) =>
                onUpdate({ condition: { ...field.condition!, operator: v as ConditionOperator } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["equals", "not_equals", "contains"] as ConditionOperator[]).map((op) => (
                  <SelectItem key={op} value={op}>
                    {isAr ? CONDITION_OPERATOR_LABELS[op].ar : CONDITION_OPERATOR_LABELS[op].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={field.condition.value}
              onChange={(e) =>
                onUpdate({ condition: { ...field.condition!, value: e.target.value } })
              }
              placeholder={t("intakeForms.condition.value")}
            />
          </div>
        )}
      </div>
    </>
  )
}
