"use client"

import { useState } from "react"
import { useIntakeScopeOptions } from '@/hooks/use-intake-scope-options'
import { validateIntakeDraft } from '@/lib/schemas/intake-form.schema'
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, FloppyDiskIcon } from "@hugeicons/core-free-icons"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { FieldEditor } from "@/components/features/intake-forms/field-editor"
import { FormSection } from "@/components/features/shared/form-section"
import { FormInfoPanel } from "@/components/features/intake-forms/form-info-panel"
import { useLocale } from "@/components/locale-provider"
import type {
  IntakeFormDraft,
  FormField,
  FormScope,
} from "@/lib/types/intake-form"

/* ─── Helpers ─── */

function createEmptyField(): FormField {
  return {
    id: crypto.randomUUID(),
    labelEn: "",
    labelAr: "",
    type: "text",
    required: false,
    options: [],
  }
}

function createEmptyDraft(): IntakeFormDraft {
  return {
    nameEn: "",
    nameAr: "",
    type: "pre_booking",
    scope: "global",
    scopeId: "",
    isActive: true,
    fields: [createEmptyField()],
  }
}

/* ─── Props ─── */

interface IntakeFormPageProps {
  mode: "create" | "edit"
  initialDraft?: Partial<IntakeFormDraft>
  onSave: (draft: IntakeFormDraft) => void
  isSaving?: boolean
  isLoadingDraft?: boolean
  fieldsLocked?: boolean
}

/* ─── Component ─── */

export function IntakeFormPage({ mode, initialDraft, onSave, isSaving, isLoadingDraft, fieldsLocked = false }: IntakeFormPageProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const router = useRouter()
  const isMultiBranch = true

  const [draft, setDraft] = useState<IntakeFormDraft>(() => ({
    ...createEmptyDraft(),
    ...initialDraft,
  }))

  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const scopeQuery = useIntakeScopeOptions(draft.scope, locale)
  const scopeOptions = scopeQuery.data?.pages.flatMap(page => page.items) ?? []
  function save() {
    const errors = validateIntakeDraft(draft)
    setValidationErrors(errors)
    if (!errors.length) onSave(draft)
  }

  function update(patch: Partial<IntakeFormDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function handleScopeChange(scope: FormScope) {
    update({ scope, scopeId: "" })
  }

  function addField() {
    update({ fields: [...draft.fields, createEmptyField()] })
  }

  function updateField(index: number, updated: FormField) {
    const fields = [...draft.fields]
    fields[index] = updated
    update({ fields })
  }

  function removeField(index: number) {
    update({ fields: draft.fields.filter((_, i) => i !== index) })
  }

  function moveField(index: number, direction: "up" | "down") {
    const fields = [...draft.fields]
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= fields.length) return
    ;[fields[index], fields[target]] = [fields[target], fields[index]]
    update({ fields })
  }

  const isEdit = mode === "edit"

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={isEdit ? t("intakeForms.page.editTitle") : t("intakeForms.page.newTitle")}
        description={t("intakeForms.page.description")}
      />

      {validationErrors.length > 0 && <ul role="alert" className="text-error">{validationErrors.map(key => <li key={key}>{t(key)}</li>)}</ul>}
      <div className="flex flex-col gap-6 pb-24">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ─── Left: Form Info ─── */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <FormInfoPanel
            draft={draft}
            scopeOptions={scopeOptions}
            availableScopes={isMultiBranch
              ? ["global", "service", "employee", "branch"]
              : ["global", "service", "employee"]
            }
            onUpdate={update}
            onScopeChange={handleScopeChange}
            isAr={isAr}
            isLoadingOptions={scopeQuery.isLoading}
            optionsError={Boolean(scopeQuery.error)}
            hasMoreOptions={Boolean(scopeQuery.hasNextPage)}
            isLoadingMore={scopeQuery.isFetchingNextPage}
            onLoadMore={() => void scopeQuery.fetchNextPage()}
            onRetry={() => void scopeQuery.refetch()}
          />
        </div>

        {/* ─── Right: Fields Builder ─── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <FormSection title={`${t("intakeForms.page.fieldsCount")} (${draft.fields.length})`}>
            {fieldsLocked && <p className="text-sm text-muted-foreground mb-3">{t("intakeForms.page.fieldsLocked")}</p>}
            <div className="flex flex-col gap-3">
              {draft.fields.map((field, i) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={i}
                  totalFields={draft.fields.length}
                  disabled={fieldsLocked}
                  onChange={(updated) => updateField(i, updated)}
                  onRemove={() => removeField(i)}
                  onMoveUp={() => moveField(i, "up")}
                  onMoveDown={() => moveField(i, "down")}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                className="gap-2 self-start mt-1"
                onClick={addField}
                disabled={fieldsLocked}
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
                {t("intakeForms.page.addField")}
              </Button>
            </div>
          </FormSection>
        </div>

        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/intake-forms")}>
          {t("intakeForms.page.cancel")}
        </Button>
        <Button size="lg" className="rounded-lg gap-2" onClick={save} disabled={isSaving || isLoadingDraft}>
          <HugeiconsIcon icon={FloppyDiskIcon} size={16} />
          {isSaving
            ? t("intakeForms.page.saving")
            : isEdit
            ? t("intakeForms.page.saveChanges")
            : t("intakeForms.page.createForm")}
        </Button>
      </div>
    </ListPageShell>
  )
}
