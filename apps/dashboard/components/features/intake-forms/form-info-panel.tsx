"use client"

import { Input, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator } from "@sawaa/ui"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import type { IntakeFormDraft, FormType, FormScope } from "@/lib/types/intake-form"
import { FORM_TYPE_LABELS, FORM_SCOPE_LABELS } from "@/lib/types/intake-form"

const FORM_TYPES: FormType[] = ["pre_booking", "pre_session", "post_session", "registration"]
const ALL_FORM_SCOPES: FormScope[] = ["global", "service", "employee", "branch"]

interface FormInfoPanelProps {
  draft: IntakeFormDraft
  scopeOptions: { value: string; label: string }[]
  /** Allowed scopes — defaults to all. Pass filtered list to hide branch when multi_branch is off. */
  availableScopes?: FormScope[]
  onUpdate: (patch: Partial<IntakeFormDraft>) => void
  onScopeChange: (scope: FormScope) => void
  isAr: boolean
}

export function FormInfoPanel({
  draft,
  scopeOptions,
  availableScopes,
  onUpdate,
  onScopeChange,
  isAr,
}: FormInfoPanelProps) {
  const { t } = useLocale()
  const formScopes = availableScopes ?? ALL_FORM_SCOPES

  return (
    <FormSection title={t("intakeForms.info.title")}>
      <div className="flex flex-col gap-4">
        <FormField label={t("intakeForms.info.nameArShort")} required>
          <Input
            value={draft.nameAr}
            onChange={(e) => onUpdate({ nameAr: e.target.value })}
            placeholder={t("intakeForms.info.nameArPlaceholder")}
            dir="rtl"
          />
        </FormField>

        <FormField label={t("intakeForms.info.nameEnShort")} required>
          <Input
            value={draft.nameEn}
            onChange={(e) => onUpdate({ nameEn: e.target.value })}
            placeholder={t("intakeForms.info.nameEnPlaceholder")}
            dir="ltr"
          />
        </FormField>

        <FormField label={t("intakeForms.info.formType")}>
          <Select
            value={draft.type}
            onValueChange={(v) => onUpdate({ type: v as FormType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {isAr ? FORM_TYPE_LABELS[ft].ar : FORM_TYPE_LABELS[ft].en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("intakeForms.info.scope")}>
          <Select
            value={draft.scope}
            onValueChange={(v) => onScopeChange(v as FormScope)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formScopes.map((s) => (
                <SelectItem key={s} value={s}>
                  {isAr ? FORM_SCOPE_LABELS[s].ar : FORM_SCOPE_LABELS[s].en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {draft.scope !== "global" && (
          <FormField
            label={t("intakeForms.info.selectScope").replace(
              "{scope}",
              isAr
                ? FORM_SCOPE_LABELS[draft.scope].ar
                : FORM_SCOPE_LABELS[draft.scope].en,
            )}
          >
            <Select
              value={draft.scopeId}
              onValueChange={(v) => onUpdate({ scopeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("intakeForms.info.select")} />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        <Separator />

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {t("intakeForms.info.activeShort")}
          </span>
          <Switch
            id="form-active"
            checked={draft.isActive}
            onCheckedChange={(v) => onUpdate({ isActive: v })}
          />
        </div>
      </div>
    </FormSection>
  )
}
