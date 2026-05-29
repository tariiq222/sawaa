"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IntakeFormPage } from "@/components/features/intake-forms/intake-form-page"
import { useIntakeFormMutations } from "@/hooks/use-intake-forms"
import { useLocale } from "@/components/locale-provider"
import type { IntakeFormDraft } from "@/lib/types/intake-form"

export default function CreateIntakeFormPage() {
  const router = useRouter()
  const { t } = useLocale()
  const { createAsync, createLoading, setFieldsAsync } = useIntakeFormMutations()

  async function handleSave(draft: IntakeFormDraft) {
    try {
      const form = await createAsync({
        nameAr: draft.nameAr,
        nameEn: draft.nameEn,
        type: draft.type,
        scope: draft.scope,
        ...(draft.scope !== "global" && draft.scopeId
          ? { scopeId: draft.scopeId }
          : {}),
        isActive: draft.isActive,
      })

      if (draft.fields.length > 0) {
        await setFieldsAsync({
          formId: form.id,
          payload: {
            fields: draft.fields.map((f, i) => ({
              labelAr: f.labelAr,
              labelEn: f.labelEn,
              fieldType: f.type,
              options: f.options.length > 0 ? f.options : undefined,
              isRequired: f.required,
              position: i,
            })),
          },
        })
      }

      toast.success(t("intakeForms.createSuccess"))
      router.push("/intake-forms")
    } catch {
      toast.error(t("intakeForms.createError"))
    }
  }

  return (
    <IntakeFormPage
      mode="create"
      onSave={handleSave}
      isSaving={createLoading}
    />
  )
}
