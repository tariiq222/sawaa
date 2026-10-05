'use client'
import { useState } from 'react'
import { Button } from '@sawaa/ui'
import { getCategoryBookingServices } from '@sawaa/shared/catalog'
import { useLocale } from '@/components/locale-provider'
import type { useClients } from '@/hooks/use-clients'
import type { useLateSessionCatalog } from '@/hooks/use-late-session-catalog'
import type { LateSessionDraft } from '@/lib/types/late-session'
import { LateSelect } from './late-session-fields'
interface Props {
  draft: LateSessionDraft
  update: (patch: Partial<LateSessionDraft>) => void
  catalog: ReturnType<typeof useLateSessionCatalog>
  clientData: ReturnType<typeof useClients>
}
export function LateSessionIdentity({
  draft,
  update,
  catalog,
  clientData,
}: Props) {
  const { t, locale } = useLocale()
  const [categoryId, setCategoryId] = useState('')
  const [selectedClient, setSelectedClient] = useState<{
    value: string
    label: string
  } | null>(null)
  const { clients, search, setSearch, page, setPage, meta, isFetching } =
    clientData
  const terminal = draft.status === 'NO_SHOW' || draft.status === 'CANCELLED'
  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
  }))
  if (
    selectedClient?.value === draft.clientId &&
    !clientOptions.some((c) => c.value === draft.clientId)
  )
    clientOptions.unshift(selectedClient)
  const branches = catalog.branches
  const placeholder = { value: '', label: t('bookings.late.choose') }
  const categories = [
    ...new Map(
      catalog.services
        .filter((s) => s.category)
        .map((s) => [s.category!.id, s.category!])
    ).values(),
  ]
  const category = categories.find((c) => c.id === categoryId)
  // Historical reads already exclude deleted rows; normalize lifecycle flags only for the shared structural selector.
  const services = category
    ? getCategoryBookingServices(
        { ...category, isActive: true, archivedAt: null },
        catalog.services.map((s) => ({
          ...s,
          isActive: true,
          archivedAt: null,
        }))
      )
    : []
  const employees = catalog.employees.filter(
    (e) =>
      e.serviceIds?.includes(draft.serviceId) &&
      (!draft.branchId || e.branchIds?.includes(draft.branchId))
  )
  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!meta?.hasPreviousPage || isFetching}
          onClick={() => {
            update({ clientId: '' })
            setPage(page - 1)
          }}
        >
          {t('bookings.late.previousClients')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!meta?.hasNextPage || isFetching}
          onClick={() => {
            update({ clientId: '' })
            setPage(page + 1)
          }}
        >
          {t('bookings.late.nextClients')}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          {t('bookings.client.search.placeholder')}
          <input
            className="h-10 rounded-lg border border-border bg-surface px-3"
            value={search}
            onChange={(e) => {
              update({ clientId: '' })
              setSearch(e.target.value)
            }}
          />
        </label>
        <LateSelect
          label={t('bookings.late.clientId')}
          value={draft.clientId}
          onChange={(clientId) => {
            setSelectedClient(
              clientOptions.find((c) => c.value === clientId) ?? null
            )
            update({ clientId })
          }}
          options={[placeholder, ...clientOptions]}
        />
        <LateSelect
          label={t('bookings.late.branchId')}
          value={draft.branchId}
          onChange={(branchId) => update({ branchId, employeeId: '' })}
          options={[
            placeholder,
            ...branches.map((b) => ({ value: b.id, label: b.nameAr })),
          ]}
        />
        <LateSelect
          label={t('bookings.late.clinic')}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id)
            const selected = categories.find((c) => c.id === id)
            const direct =
              selected?.bookingMode === 'DIRECT'
                ? getCategoryBookingServices(
                    { ...selected, isActive: true, archivedAt: null },
                    catalog.services.map((s) => ({
                      ...s,
                      isActive: true,
                      archivedAt: null,
                    }))
                  )[0]
                : undefined
            update({
              serviceId: direct?.id ?? '',
              employeeId: '',
              amount: terminal ? '0' : '',
            })
          }}
          options={[
            placeholder,
            ...categories.map((c) => ({
              value: c.id,
              label: locale === 'ar' ? c.nameAr : (c.nameEn ?? c.nameAr),
            })),
          ]}
        />
        {category?.bookingMode !== 'DIRECT' && (
          <LateSelect
            label={t('bookings.late.serviceId')}
            value={draft.serviceId}
            onChange={(serviceId) => {
              const s = services.find((s) => s.id === serviceId)
              update({
                serviceId,
                employeeId: '',
                ...(s
                  ? {
                      amount: terminal ? '0' : String(Number(s.price) / 100),
                      durationMins: String(s.durationMins),
                    }
                  : {}),
              })
            }}
            options={[
              placeholder,
              ...services.map((s) => ({
                value: s.id,
                label:
                  category?.bookingMode === 'DIRECT'
                    ? category.nameAr
                    : locale === 'ar'
                      ? s.nameAr
                      : (s.nameEn ?? s.nameAr),
              })),
            ]}
          />
        )}
        {category?.bookingMode === 'DIRECT' && !draft.serviceId && (
          <p role="alert">{t('bookings.late.missingDirect')}</p>
        )}
        <LateSelect
          label={t('bookings.late.employeeId')}
          value={draft.employeeId}
          onChange={(employeeId) => update({ employeeId })}
          options={[
            placeholder,
            ...employees.map((e) => ({
              value: e.id,
              label: `${e.user.firstName} ${e.user.lastName}`,
            })),
          ]}
        />
      </div>
    </>
  )
}
