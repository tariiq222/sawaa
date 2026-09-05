"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IntakeFormPage } from "@/components/features/intake-forms/intake-form-page"
import { useIntakeFormMutations } from "@/hooks/use-intake-forms"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import type { IntakeFormDraft } from "@/lib/types/intake-form"
import { PermissionGuard } from "@/components/features/permission-guard"
import { mapDraftToCreate } from "@/lib/mappers/intake-form"

export default function CreateIntakeFormPage() {
  return (
    <PermissionGuard module="setting" action="create">
      <CreateIntakeFormPageInner />
    </PermissionGuard>
  )
}

function CreateIntakeFormPageInner() {
  const router = useRouter()
  const { t } = useLocale()
  const { createAsync, createLoading } = useIntakeFormMutations()

  async function handleSave(draft: IntakeFormDraft) {
    try {
      await createAsync(mapDraftToCreate(draft))

      toast.success(t("intakeForms.createSuccess"))
      router.push("/intake-forms")
    } catch (err) {
      showApiError(err, { fallback: t("intakeForms.createError"), t })
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
