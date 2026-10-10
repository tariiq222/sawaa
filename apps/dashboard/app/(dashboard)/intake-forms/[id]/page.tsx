"use client"
import { useParams } from 'next/navigation'
import { PermissionGuard } from '@/components/features/permission-guard'
import { ListPageShell } from '@/components/features/list-page-shell'
import { Breadcrumbs } from '@/components/features/breadcrumbs'
import { PageHeader } from '@/components/features/page-header'
import { IntakeFormPreview } from '@/components/features/intake-forms/intake-form-preview'
import { useIntakeForm } from '@/hooks/use-intake-forms'
import { useLocale } from '@/components/locale-provider'
import { mapApiForm } from '@/lib/mappers/intake-form'

export default function IntakeFormDetailRoute() {
  return <PermissionGuard module="setting" action="read"><IntakeFormDetailInner /></PermissionGuard>
}
function IntakeFormDetailInner() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useIntakeForm(id)
  const { t, locale } = useLocale()
  if (isLoading) return <p role="status" className="p-6">{t('common.loading')}</p>
  if (error || !data) return <p role="alert" className="p-6 text-error">{t('common.errorLoading')}</p>
  const form = mapApiForm(data)
  return <ListPageShell><Breadcrumbs /><PageHeader title={(locale === 'en' ? form.nameEn : '') || form.nameAr} description={t('auditOperations.previewTitle')} /><IntakeFormPreview form={form} /></ListPageShell>
}
