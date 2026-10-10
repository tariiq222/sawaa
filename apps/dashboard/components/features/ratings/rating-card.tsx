"use client"
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon } from '@hugeicons/core-free-icons'
import { Card, CardContent, Badge, Switch } from '@sawaa/ui'
import { toast } from 'sonner'
import { useLocale } from '@/components/locale-provider'
import { useRatingMutations } from '@/hooks/use-ratings'
import { formatLocaleDate } from '@/lib/date'
import type { Rating } from '@/lib/types/rating'

export function RatingCard({ rating: r }: { rating: Rating }) {
  const { t, locale } = useLocale()
  const { updateVisibility } = useRatingMutations()
  return <Card className="h-full"><CardContent className="flex h-full flex-col justify-between gap-3 p-4">
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-2"><div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <HugeiconsIcon key={i} icon={StarIcon} size={14} fill={i < r.stars ? 'currentColor' : 'none'} className={i < r.stars ? 'text-warning' : 'text-muted-foreground/30'} />)}</div><Badge variant="secondary">{r.stars}/5</Badge></div>
      <p className="text-sm font-medium">{(locale === 'en' ? r.employee?.nameEn : null) || r.employee?.name || t('auditOperations.employeeUnavailable')}</p>
      {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
      <p className="text-xs text-muted-foreground">{r.client?.name || t('ratings.anonymous')} · {formatLocaleDate(r.createdAt, locale)}</p>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">{r.isPublic ? t('ratings.public') : t('ratings.private')}</span>
      <Switch checked={r.isPublic} aria-label={t('auditOperations.ratingVisibility')} disabled={updateVisibility.isPending && updateVisibility.variables?.id === r.id}
        onCheckedChange={isPublic => updateVisibility.mutate({id:r.id,isPublic}, {onSuccess:()=>toast.success(t('auditOperations.saved')),onError:()=>toast.error(t('auditOperations.saveError'))})} />
    </div>
  </CardContent></Card>
}
