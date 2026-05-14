"use client"

import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { IntakeFormDraft, FormType, FormScope } from "@/lib/types/intake-form"
import {
  FORM_TYPE_LABELS,
  FORM_SCOPE_LABELS,
} from "@/lib/types/intake-form"

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

export function FormInfoPanel({ draft, scopeOptions, availableScopes, onUpdate, onScopeChange, isAr }: FormInfoPanelProps) {
  const { t } = useLocale()
  const formScopes = availableScopes ?? ALL_FORM_SCOPES

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {t("intakeForms.info.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("intakeForms.info.nameArShort")} *</Label>
          <Input
            value={draft.nameAr}
            onChange={(e) => onUpdate({ nameAr: e.target.value })}
            placeholder={t("intakeForms.info.nameArPlaceholder")}
            dir="rtl"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("intakeForms.info.nameEnShort")} *</Label>
          <Input
            value={draft.nameEn}
            onChange={(e) => onUpdate({ nameEn: e.target.value })}
            placeholder={t("intakeForms.info.nameEnPlaceholder")}
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("intakeForms.info.formType")}</Label>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("intakeForms.info.scope")}</Label>
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
        </div>

        {draft.scope !== "global" && (
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("intakeForms.info.selectScope").replace(
                "{scope}",
                isAr
                  ? FORM_SCOPE_LABELS[draft.scope].ar
                  : FORM_SCOPE_LABELS[draft.scope].en,
              )}
            </Label>
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
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="form-active" className="cursor-pointer text-sm">
            {t("intakeForms.info.activeShort")}
          </Label>
          <Switch
            id="form-active"
            checked={draft.isActive}
            onCheckedChange={(v) => onUpdate({ isActive: v })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
