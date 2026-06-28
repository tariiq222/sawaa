"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchEmployees } from "@/lib/api/employees"
import { fetchServices } from "@/lib/api/services"
import { fetchBranches } from "@/lib/api/branches"
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
}

/* ─── Component ─── */

export function IntakeFormPage({ mode, initialDraft, onSave, isSaving, isLoadingDraft }: IntakeFormPageProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const router = useRouter()
  const isMultiBranch = true

  const [draft, setDraft] = useState<IntakeFormDraft>(() => ({
    ...createEmptyDraft(),
    ...initialDraft,
  }))

  /* ─── Scope Options — real API data ─── */

  const { data: employeesData } = useQuery({
    queryKey: ["employees", "scope-select"],
    queryFn: () => fetchEmployees({ page: 1, limit: 100 }),
    enabled: draft.scope === "employee",
  })

  const { data: servicesData } = useQuery({
    queryKey: ["services", "scope-select"],
    queryFn: () => fetchServices({ page: 1, limit: 100 }),
    enabled: draft.scope === "service",
  })

  const { data: branchesData } = useQuery({
    queryKey: ["branches", "scope-select"],
    queryFn: () => fetchBranches({ page: 1, limit: 100 }),
    // Only fetch branches when multi_branch is enabled and scope is "branch"
    enabled: isMultiBranch && draft.scope === "branch",
  })

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

  const scopeOptions = useMemo(() => {
    if (draft.scope === "employee") {
      return (employeesData?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.user.firstName} ${p.user.lastName}`,
      }))
    }
    if (draft.scope === "service") {
      return (servicesData?.items ?? []).map((s) => ({
        value: s.id,
        label: isAr ? s.nameAr : (s.nameEn ?? s.nameAr),
      }))
    }
    if (draft.scope === "branch" && isMultiBranch) {
      return (branchesData?.items ?? []).map((b) => ({
        value: b.id,
        label: isAr ? b.nameAr : b.nameEn,
      }))
    }
    return []
  }, [draft.scope, employeesData, servicesData, branchesData, isAr, isMultiBranch])

  const isEdit = mode === "edit"

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={isEdit ? t("intakeForms.page.editTitle") : t("intakeForms.page.newTitle")}
        description={t("intakeForms.page.description")}
      />

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
          />
        </div>

        {/* ─── Right: Fields Builder ─── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <FormSection title={`${t("intakeForms.page.fieldsCount")} (${draft.fields.length})`}>
            <div className="flex flex-col gap-3">
              {draft.fields.map((field, i) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={i}
                  totalFields={draft.fields.length}
                  prevFields={draft.fields.slice(0, i)}
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
        <Button size="lg" className="rounded-lg gap-2" onClick={() => onSave(draft)} disabled={isSaving || isLoadingDraft}>
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
