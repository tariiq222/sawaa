"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IntakeFormPage } from "@/components/features/intake-forms/intake-form-page"
import { useIntakeForm, useIntakeFormMutations } from "@/hooks/use-intake-forms"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import type { IntakeFormDraft } from "@/lib/types/intake-form"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"
import { PermissionGuard } from "@/components/features/permission-guard"
import { mapDraftToUpdate, mapFormToDraft } from "@/lib/mappers/intake-form"

export default function EditIntakeFormPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <PermissionGuard module="setting" action="update">
      <EditIntakeFormPageInner params={params} />
    </PermissionGuard>
  )
}

function EditIntakeFormPageInner({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { t } = useLocale()
  const { data: form, isLoading, error } = useIntakeForm(id)
  if (error) return <p role="alert" className="p-6 text-destructive">{t("intakeForms.page.loadError")}</p>
  if (isLoading || !form) return <p className="p-6 text-muted-foreground">{t("common.loading")}</p>
  return <LoadedIntakeFormEditor key={form.id} form={form} />
}

function LoadedIntakeFormEditor({ form }: { form: IntakeFormApi }) {
  const [baseline] = useState(form)
  const router = useRouter()
  const { t } = useLocale()
  const { updateAsync, updateLoading } =
    useIntakeFormMutations()

  async function handleSave(draft: IntakeFormDraft) {
    try {
      await updateAsync({
        formId: form.id,
        payload: mapDraftToUpdate(draft, baseline),
      })

      toast.success(t("intakeForms.saveSuccess"))
      router.push("/intake-forms")
    } catch (err) {
      showApiError(err, { fallback: t("intakeForms.saveError"), t })
    }
  }

  return (
    <IntakeFormPage
      mode="edit"
      initialDraft={mapFormToDraft(baseline)}
      fieldsLocked={form.submissionsCount > 0}
      onSave={handleSave}
      isSaving={updateLoading}
    />
  )
}
