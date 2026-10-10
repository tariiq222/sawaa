"use client"
import { Input, Textarea } from '@sawaa/ui'
import { useLocale } from '@/components/locale-provider'
import type { IntakeForm } from '@/lib/types/intake-form'

/** Interactive local preview: answers never leave this component. */
export function IntakeFormPreview({ form }: { form: IntakeForm }) {
  const { t, locale } = useLocale()
  return <section className="space-y-6 rounded-xl border border-border bg-surface-solid p-6">
    <p className="text-sm text-muted-foreground">{t('auditOperations.previewNote')}</p>
    {form.fields?.map(field => {
      const label = (locale === 'en' ? field.labelEn : '') || field.labelAr
      const id = `preview-${field.id}`
      return <div key={field.id} className="space-y-2">
        <label htmlFor={id} className="block text-sm font-medium">{label}{field.required && ' *'}</label>
        {field.type === 'textarea' ? <Textarea id={id} />
          : field.type === 'select' ? <select id={id} className="w-full rounded-lg border border-border bg-background p-2"><option value="">{t('intakeForms.info.select')}</option>{field.options.map((option, i) => <option key={i}>{option}</option>)}</select>
          : ['radio', 'checkbox'].includes(field.type) ? <fieldset aria-label={label} className="space-y-2">{field.options.map((option, i) => <label key={i} className="flex items-center gap-2 text-sm"><input type={field.type} name={id} value={option} />{option}</label>)}</fieldset>
          : <Input id={id} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} />}
      </div>
    })}
  </section>
}
