import type { IntakeForm, FormField, IntakeFormDraft } from "@/lib/types/intake-form"
import type { IntakeFormApi, IntakeFieldApi, SetFieldItemApiPayload, CreateIntakeFormApiPayload, UpdateIntakeFormApiPayload } from "@/lib/types/intake-form-api"

/* ─── API shape → Frontend shape ─── */

export function mapApiForm(f: IntakeFormApi): IntakeForm {
  const scopeId = f.scopeId ?? ""

  const fields: FormField[] =
    f.fields?.map(
      (fi: IntakeFieldApi): FormField => ({
        id: fi.id,
        labelEn: fi.labelEn ?? "",
        labelAr: fi.labelAr,
        type: fi.fieldType,
        required: fi.isRequired,
        options: fi.options ?? [],
      })
    ) ?? []

  return {
    id: f.id,
    ref: f.ref,
    nameEn: f.nameEn ?? "",
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

export function mapFormToDraft(form: IntakeFormApi): IntakeFormDraft {
  const mapped = mapApiForm(form)
  return {
    nameAr: mapped.nameAr, nameEn: mapped.nameEn,
    type: mapped.type, scope: mapped.scope, scopeId: mapped.scopeId ?? "",
    isActive: mapped.isActive, fields: mapped.fields ?? [],
  }
}

function mapDraftFields(fields: FormField[]): SetFieldItemApiPayload[] {
  return fields.map((field, position) => ({
    labelAr: field.labelAr, labelEn: field.labelEn,
    fieldType: field.type, options: field.options,
    isRequired: field.required, position,
  }))
}

export function mapDraftToCreate(draft: IntakeFormDraft): CreateIntakeFormApiPayload {
  return {
    nameAr: draft.nameAr, nameEn: draft.nameEn,
    type: draft.type, scope: draft.scope,
    ...(draft.scope !== "global" ? { scopeId: draft.scopeId } : {}),
    isActive: draft.isActive, fields: mapDraftFields(draft.fields),
  }
}

export function mapDraftToUpdate(draft: IntakeFormDraft, original: IntakeFormApi): UpdateIntakeFormApiPayload {
  const baseline = mapFormToDraft(original)
  const fields = mapDraftFields(draft.fields)
  const originalFields = mapDraftFields(baseline.fields)
  const scopeChanged = draft.scope !== baseline.scope || draft.scopeId !== baseline.scopeId
  return {
    ...(draft.nameAr !== baseline.nameAr ? { nameAr: draft.nameAr } : {}),
    ...(draft.nameEn !== baseline.nameEn ? { nameEn: draft.nameEn } : {}),
    ...(draft.type !== baseline.type ? { type: draft.type } : {}),
    ...(draft.isActive !== baseline.isActive ? { isActive: draft.isActive } : {}),
    ...(scopeChanged ? { scope: draft.scope, scopeId: draft.scope === "global" ? null : draft.scopeId } : {}),
    ...(JSON.stringify(fields) !== JSON.stringify(originalFields) ? { fields } : {}),
  }
}
