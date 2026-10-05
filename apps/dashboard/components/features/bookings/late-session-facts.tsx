'use client'
import { useLocale } from '@/components/locale-provider'
import type { LateSessionDraft } from '@/lib/types/late-session'
import type { PaymentMethodOption } from '@/components/features/shared/payment-method-picker'
import { LateSelect, LateTextField } from './late-session-fields'
interface Props {
  draft: LateSessionDraft
  update: (patch: Partial<LateSessionDraft>) => void
  methods: PaymentMethodOption[]
  canPay: boolean
}
export function LateSessionFacts({ draft, update, methods, canPay }: Props) {
  const { t } = useLocale()
  const terminal = draft.status === 'CANCELLED' || draft.status === 'NO_SHOW'
  const options = (values: readonly string[]) =>
    values.map((value) => ({ value, label: t('bookings.late.' + value) }))
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LateSelect
        label={t('bookings.late.deliveryType')}
        value={draft.deliveryType}
        onChange={(v) =>
          update({ deliveryType: v as LateSessionDraft['deliveryType'] })
        }
        options={options(['IN_PERSON', 'ONLINE'])}
      />
      <LateTextField
        field="scheduledAt"
        type="datetime-local"
        draft={draft}
        update={update}
      />
      <LateTextField
        field="durationMins"
        type="number"
        draft={draft}
        update={update}
      />
      <LateSelect
        label={t('bookings.late.status')}
        value={draft.status}
        onChange={(v) =>
          update({
            status: v as LateSessionDraft['status'],
            ...(['CANCELLED', 'NO_SHOW'].includes(v)
              ? { amount: '0', paymentMode: 'UNPAID' }
              : {}),
          })
        }
        options={options(['COMPLETED', 'CONFIRMED', 'NO_SHOW', 'CANCELLED'])}
      />
      {draft.status === 'CANCELLED' && (
        <>
          <LateTextField
            field="cancelledAt"
            type="datetime-local"
            draft={draft}
            update={update}
          />
          <LateTextField
            field="cancellationReason"
            draft={draft}
            update={update}
          />
        </>
      )}
      {draft.status === 'NO_SHOW' && (
        <LateTextField
          field="noShowAt"
          type="datetime-local"
          draft={draft}
          update={update}
        />
      )}
      {!terminal && (
        <LateTextField field="amount" draft={draft} update={update} />
      )}
      <LateTextField field="notes" draft={draft} update={update} />
      <LateSelect
        label={t('bookings.late.priorInvoice')}
        value={draft.priorInvoice}
        onChange={(v) =>
          update({ priorInvoice: v as LateSessionDraft['priorInvoice'] })
        }
        options={options(['NONE', 'INTERNAL', 'EXTERNAL'])}
      />
      {!terminal && canPay && (
        <LateSelect
          label={t('bookings.late.paymentMode')}
          value={draft.paymentMode}
          onChange={(v) =>
            update({
              paymentMode: v as LateSessionDraft['paymentMode'],
              paymentMethod: methods[0]?.value ?? 'CASH',
            })
          }
          options={options(
            methods.length
              ? ['UNPAID', 'PREVIOUSLY_RECEIVED', 'COLLECT_NOW']
              : ['UNPAID']
          )}
        />
      )}
      {draft.paymentMode !== 'UNPAID' && (
        <>
          <LateTextField field="paymentAmount" draft={draft} update={update} />
          <LateSelect
            label={t('bookings.late.paymentMethod')}
            value={draft.paymentMethod}
            onChange={(v) =>
              update({
                paymentMethod: v as LateSessionDraft['paymentMethod'],
              })
            }
            options={options(methods.map((m) => m.value))}
          />
        </>
      )}
      {draft.paymentMode === 'PREVIOUSLY_RECEIVED' && (
        <>
          <LateTextField
            field="receivedAt"
            type="datetime-local"
            draft={draft}
            update={update}
          />
          <LateTextField
            field="receiptEvidenceRef"
            draft={draft}
            update={update}
          />
          <LateTextField
            field="receiptEntryReason"
            draft={draft}
            update={update}
          />
        </>
      )}
    </div>
  )
}
