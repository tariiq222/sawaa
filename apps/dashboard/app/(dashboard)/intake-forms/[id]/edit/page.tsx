"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IntakeFormPage } from "@/components/features/intake-forms/intake-form-page"
import { useIntakeForm, useIntakeFormMutations } from "@/hooks/use-intake-forms"
import { useLocale } from "@/components/locale-provider"
import type { IntakeFormDraft } from "@/lib/types/intake-form"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"

/* ─── Map API form → draft ─── */

function mapToDraft(form: IntakeFormApi): Partial<IntakeFormDraft> {
  const scopeId =
    form.serviceId ?? form.employeeId ?? form.branchId ?? ""

  return {
    nameEn: form.nameEn,
    nameAr: form.nameAr,
    type: form.type,
    scope: form.scope,
    scopeId,
    isActive: form.isActive,
    fields: form.fields.map((f) => ({
      id: f.id,
      labelEn: f.labelEn,
      labelAr: f.labelAr,
      type: f.fieldType,
      required: f.isRequired,
      options: f.options ?? [],
      condition: f.condition ?? undefined,
    })),
  }
}

export default function EditIntakeFormPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useLocale()
  const { data: form, isLoading } = useIntakeForm(id)
  const { updateAsync, updateLoading, setFieldsAsync, setFieldsLoading } =
    useIntakeFormMutations()

  async function handleSave(draft: IntakeFormDraft) {
    try {
      await updateAsync({
        formId: id,
        payload: {
          nameAr: draft.nameAr,
          nameEn: draft.nameEn,
          isActive: draft.isActive,
        },
      })

      await setFieldsAsync({
        formId: id,
        payload: {
          fields: draft.fields.map((f, i) => ({
            labelAr: f.labelAr,
            labelEn: f.labelEn,
            fieldType: f.type,
            options: f.options.length > 0 ? f.options : undefined,
            condition: f.condition,
            isRequired: f.required,
            sortOrder: i,
          })),
        },
      })

      toast.success(t("intakeForms.saveSuccess"))
      router.push("/intake-forms")
    } catch {
      toast.error(t("intakeForms.saveError"))
    }
  }

  return (
    <IntakeFormPage
      key={form?.id ?? "loading"}
      mode="edit"
      initialDraft={form ? mapToDraft(form) : undefined}
      isLoadingDraft={isLoading}
      onSave={handleSave}
      isSaving={updateLoading || setFieldsLoading}
    />
  )
}
