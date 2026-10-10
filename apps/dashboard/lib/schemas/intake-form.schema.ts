import type { IntakeFormDraft } from '@/lib/types/intake-form'
/** Validation mirrors the persisted Arabic-required/English-optional form contract. */
export function validateIntakeDraft(draft: IntakeFormDraft): string[] {
  const errors: string[] = []
  if (!draft.nameAr.trim()) errors.push('auditOperations.intakeNameRequired')
  if (draft.scope !== 'global' && !draft.scopeId) errors.push('auditOperations.intakeScopeRequired')
  if (draft.fields.some(f => !f.labelAr.trim())) errors.push('auditOperations.intakeLabelRequired')
  if (draft.fields.some(f => ['radio', 'checkbox', 'select'].includes(f.type) && (!f.options.length || f.options.some(option => !option.trim())))) errors.push('auditOperations.intakeOptionsRequired')
  return errors
}
