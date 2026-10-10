import { describe, expect, it } from 'vitest'
import { validateIntakeDraft } from '@/lib/schemas/intake-form.schema'
import type { IntakeFormDraft } from '@/lib/types/intake-form'
const draft = (patch: Partial<IntakeFormDraft> = {}): IntakeFormDraft => ({nameAr:'نموذج',nameEn:'',type:'pre_session',scope:'global',scopeId:'',isActive:true,fields:[{id:'f1',labelAr:'السؤال',labelEn:'',type:'text',required:false,options:[]}],...patch})
describe('intake draft validation', () => {
  it('rejects a blank form name', () => expect(validateIntakeDraft(draft({nameAr:'  '}))).toContain('auditOperations.intakeNameRequired'))
  it('rejects a targeted scope without an entity', () => expect(validateIntakeDraft(draft({scope:'service'}))).toContain('auditOperations.intakeScopeRequired'))
  it('rejects empty selectable options', () => expect(validateIntakeDraft(draft({fields:[{id:'f1',labelAr:'السؤال',labelEn:'',type:'select',required:false,options:[' ']}]}))).toContain('auditOperations.intakeOptionsRequired'))
  it('allows valid Arabic forms without optional English names', () => expect(validateIntakeDraft(draft())).toEqual([]))
})
