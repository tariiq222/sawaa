import type { IntakeForm, FormField } from "@/lib/types/intake-form"
import type { IntakeFormApi, IntakeFieldApi } from "@/lib/types/intake-form-api"

/* ─── API shape → Frontend shape ─── */

export function mapApiForm(f: IntakeFormApi): IntakeForm {
  const scopeId = f.serviceId ?? f.employeeId ?? f.branchId ?? ""

  const fields: FormField[] =
    f.fields?.map(
      (fi: IntakeFieldApi): FormField => ({
        id: fi.id,
        labelEn: fi.labelEn,
        labelAr: fi.labelAr,
        type: fi.fieldType,
        required: fi.isRequired,
        options: fi.options ?? [],
        condition: fi.condition ?? undefined,
      })
    ) ?? []

  return {
    id: f.id,
    nameEn: f.nameEn,
    nameAr: f.nameAr,
    type: f.type,
    scope: f.scope,
    scopeId,
    scopeLabel: null,
    isActive: f.isActive,
    fieldsCount: fields.length,
    submissionsCount: f.submissionsCount,
    createdAt: f.createdAt,
    fields,
  }
}
