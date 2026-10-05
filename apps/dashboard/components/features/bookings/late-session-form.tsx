'use client'
import { grossWithVat } from '@/lib/money'
import { useState } from 'react'
import { Button } from '@sawaa/ui'
import { useLocale } from '@/components/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useClients } from '@/hooks/use-clients'
import {
  useLateSessionCatalog,
  useLateSessionExistingBookings,
} from '@/hooks/use-late-session-catalog'
import { useRecordLateSession } from '@/hooks/use-record-late-session'
import {
  useLateSessionContext,
  useOpenLateSessionConflict,
} from '@/hooks/use-late-session-context'
import { lateSessionConflict } from './late-session-conflict'
import { PAYMENT_METHODS } from '@/components/features/shared/payment-method-picker'
import { moneyInputToHalalas } from '@/lib/money-input'
import {
  buildLateSessionPayload,
  defaultLateSessionDraft,
} from '@/lib/schemas/late-session.schema'
import type { LateSessionDraft } from '@/lib/types/late-session'
import type { Booking } from '@/lib/types/booking'
import { LateSessionIdentity } from './late-session-identity'
import { LateSessionFacts } from './late-session-facts'
export function LateSessionForm({
  onCancel,
  onSaved,
  onOpenExisting,
}: {
  onCancel: () => void
  onSaved: (booking: Booking) => void
  onOpenExisting?: (booking: Booking) => void
}) {
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const [draft, setDraft] = useState<LateSessionDraft>(defaultLateSessionDraft)
  const [error, setError] = useState('')
  const [conflictId, setConflictId] = useState<string | undefined>()
  const openConflict = useOpenLateSessionConflict()
  const [existingSearch, setExistingSearch] = useState('')
  const existing = useLateSessionExistingBookings(
    existingSearch,
    draft.priorInvoice === 'INTERNAL',
    draft.clientId
  )
  const clientData = useClients()
  const { isFetching } = clientData
  const catalog = useLateSessionCatalog()
  const record = useRecordLateSession()
  const policy = useLateSessionContext()
  const settings = policy.data
  const policyReady = !!settings && !policy.isLoading && !policy.error
  const update = (patch: Partial<LateSessionDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
    setConflictId(undefined)
  }
  const methods = PAYMENT_METHODS.filter((m) =>
    settings?.paymentMethods.includes(m.value)
  )
  const canPay = canDo('Payment', 'create')
  const amount = moneyInputToHalalas(draft.amount) ?? 0
  const vatRate = settings?.vatRate ?? 0
  const total = grossWithVat(amount, vatRate)
  const outstanding =
    total -
    (draft.paymentMode === 'UNPAID'
      ? 0
      : (moneyInputToHalalas(draft.paymentAmount) ?? 0))
  const currency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'SAR',
    }).format(n / 100)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      if (amount > 0 && !policyReady)
        throw new Error('bookings.late.policyUnavailable')
      if (
        !canDo('Booking', 'create') ||
        (amount > 0 && !canDo('Invoice', 'create')) ||
        (draft.paymentMode !== 'UNPAID' &&
          (!canPay || !methods.some((m) => m.value === draft.paymentMethod)))
      )
        throw new Error('common.noPermission')
      const { creationIdempotencyKey: _key, ...payload } =
        buildLateSessionPayload(draft, '', new Date(), vatRate)
      await record.submit(payload)
    } catch (e) {
      const conflict = lateSessionConflict(e)
      setConflictId(conflict?.bookingId)
      setError(
        conflict
          ? 'bookings.late.conflict'
          : e instanceof Error
            ? e.message
            : 'bookings.late.invalidFields'
      )
    }
  }
  if (record.data)
    return (
      <div
        className="space-y-4 rounded-xl border border-border bg-surface p-6"
        role="status"
      >
        <h2>{t('bookings.late.saved')}</h2>
        <p>
          {t('bookings.late.outstanding')}: {currency(record.data.outstanding)}
        </p>
        <p>
          {t('bookings.late.recordedAt')}:{' '}
          {new Date(record.data.lateEntryRecordedAt).toLocaleString(locale, {
            timeZone: 'Asia/Riyadh',
          })}
        </p>
        <Button onClick={() => onSaved(record.data!.booking)}>
          {t('bookings.late.openBooking')}
        </Button>
      </div>
    )
  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-xl border border-border bg-surface p-6"
    >
      <h2 className="text-lg font-semibold">{t('bookings.late.title')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('bookings.late.invoiceNotice')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('bookings.late.accountingNotice')}
      </p>
      <fieldset disabled={record.isPending} className="space-y-6">
        <LateSessionIdentity
          draft={draft}
          update={update}
          catalog={catalog}
          clientData={clientData}
        />
        <LateSessionFacts
          draft={draft}
          update={update}
          methods={methods}
          canPay={canPay}
        />
        {draft.priorInvoice !== 'NONE' && (
          <p role="alert">
            {t('bookings.late.priorInvoiceBlocked')}
            {draft.priorInvoice === 'INTERNAL' && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('bookings.late.findExisting')}
              </Button>
            )}
          </p>
        )}
        {draft.priorInvoice === 'INTERNAL' && (
          <div className="space-y-2">
            <label className="flex flex-col gap-2 text-sm">
              {t('bookings.late.findExisting')}
              <input
                className="h-10 rounded-lg border border-border bg-surface px-3"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
              />
            </label>
            {existing.data?.items
              .filter((b) => b.invoice)
              .map((b) => (
                <Button
                  key={b.id}
                  type="button"
                  variant="outline"
                  onClick={() => onOpenExisting?.(b)}
                >
                  #{b.bookingNumber} · {b.client?.firstName}{' '}
                  {b.client?.lastName} · {b.date}
                </Button>
              ))}
          </div>
        )}
        <p>
          {t('bookings.late.scheduledAt')}: {draft.scheduledAt || '—'} ·{' '}
          {t('bookings.late.durationMins')}: {draft.durationMins} ·{' '}
          {t('bookings.late.status')}: {t('bookings.late.' + draft.status)}
        </p>
        <p>
          {t('bookings.late.entryPreview')}:{' '}
          {new Date().toLocaleString(locale, { timeZone: 'Asia/Riyadh' })}
        </p>
        {draft.paymentMode === 'PREVIOUSLY_RECEIVED' && (
          <p>
            {t('bookings.late.receivedAt')}: {draft.receivedAt || '—'}
          </p>
        )}
        {!policyReady && amount > 0 && (
          <p role="status">{t('bookings.late.policyUnavailable')}</p>
        )}
        {policyReady && vatRate > 0 && (
          <p>
            {t('bookings.late.vat')}: {currency(total - amount)}
          </p>
        )}
        {(policyReady || amount === 0) && (
          <p>
            {t('bookings.late.total')}: {currency(total)} ·{' '}
            {t('bookings.late.outstanding')}: {currency(outstanding)}
          </p>
        )}
        {(error || catalog.error) && (
          <p role="alert" className="text-error">
            {error ? t(error) : t('bookings.late.catalogError')}
          </p>
        )}
        {conflictId && canDo('Booking', 'read') && onOpenExisting && (
          <Button
            type="button"
            variant="outline"
            disabled={openConflict.isPending}
            onClick={async () => {
              try {
                const booking = await openConflict.mutateAsync(conflictId)
                onOpenExisting(booking)
              } catch {
                setError('bookings.late.openExistingFailed')
              }
            }}
          >
            {t('bookings.late.openExisting')}
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={
              (amount > 0 && !policyReady) ||
              catalog.loading ||
              !!catalog.error ||
              isFetching ||
              draft.priorInvoice !== 'NONE' ||
              !canDo('Booking', 'create')
            }
          >
            {t('bookings.late.save')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
