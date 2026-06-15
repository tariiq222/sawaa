'use client';

import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import type { PublicBranch } from './booking.api';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { therapistDisplayName } from './therapist-name';

export type SummaryScreen = 'branch' | 'service' | 'therapist' | 'slot';

export interface SummarySelection {
  branch: PublicBranch | null;
  showBranch: boolean;
  service: Service | null;
  choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' } | null;
  employee: EmployeeWithUser | null;
  slot: AvailableSlot | null;
  /** Date being browsed on the slot screen — shown before a time is picked. */
  pendingDateIso?: string | null;
  /** The screen currently shown — its row hides the edit affordance. */
  activeScreen?: SummaryScreen | null;
  vatRate?: number;
  /** Jump back to a completed step to change it. Omit to hide edit affordances. */
  onEdit?: (screen: SummaryScreen) => void;
}

type ResolvedChoice = {
  durationMins: number | null;
  price: number | null;
  deliveryType: 'IN_PERSON' | 'ONLINE' | null;
};

/**
 * Resolve the picked duration option / booking config into display values.
 * Mirrors the extended shape the service picker reads (durationOptions /
 * bookingConfigs are not part of the base `Service` type).
 */
function resolveChoice(
  service: Service | null,
  choice: SummarySelection['choice'],
): ResolvedChoice {
  if (!service) return { durationMins: null, price: null, deliveryType: null };
  const extended = service as Service & {
    durationMins?: number;
    bookingConfigs?: Array<{
      id: string;
      deliveryType: 'IN_PERSON' | 'ONLINE';
      price: number | string;
      durationMins: number;
    }>;
    durationOptions?: Array<{
      id: string;
      durationMins: number;
      price: number | string;
    }>;
  };
  const fromOption = choice
    ? extended.durationOptions?.find((o) => o.id === choice.durationOptionId)
    : undefined;
  const fromConfig = choice
    ? extended.bookingConfigs?.find((c) => c.id === choice.durationOptionId)
    : undefined;
  const picked = fromOption ?? fromConfig;
  return {
    durationMins: picked?.durationMins ?? extended.durationMins ?? service.duration ?? null,
    price: picked ? Number(picked.price) : Number(service.price ?? 0) || null,
    deliveryType: choice?.deliveryType ?? null,
  };
}

function useSummaryRows(sel: SummarySelection) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const dateLocale = isAr ? 'ar-SA' : 'en-US';
  const resolved = resolveChoice(sel.service, sel.choice);

  const rows: Array<{
    screen: SummaryScreen;
    label: string;
    value: string | null;
    sub?: string | null;
  }> = [];

  if (sel.showBranch) {
    rows.push({
      screen: 'branch',
      label: t('booking.step.branch'),
      value: sel.branch ? (isAr ? sel.branch.nameAr : sel.branch.nameEn || sel.branch.nameAr) : null,
    });
  }

  const serviceMeta: string[] = [];
  if (resolved.durationMins) {
    serviceMeta.push(`${resolved.durationMins} ${isAr ? 'دقيقة' : 'min'}`);
  }
  if (resolved.deliveryType) {
    serviceMeta.push(
      resolved.deliveryType === 'ONLINE'
        ? isAr ? 'أونلاين' : 'Online'
        : isAr ? 'حضوري' : 'In-person',
    );
  }
  rows.push({
    screen: 'service',
    label: t('booking.step.service'),
    value: sel.service ? (isAr ? sel.service.nameAr : sel.service.nameEn) : null,
    sub: serviceMeta.length > 0 ? serviceMeta.join(' · ') : null,
  });

  const therapistName = sel.employee ? therapistDisplayName(sel.employee, isAr) || null : null;
  rows.push({
    screen: 'therapist',
    label: t('booking.step.therapist'),
    value: therapistName || null,
  });

  let slotValue: string | null = null;
  let slotSub: string | null = null;
  if (sel.slot) {
    const start = new Date(sel.slot.startTime);
    slotValue = start.toLocaleDateString(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    slotSub = start.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  } else if (sel.pendingDateIso) {
    slotValue = new Date(`${sel.pendingDateIso}T00:00:00`).toLocaleDateString(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
  rows.push({
    screen: 'slot',
    label: t('booking.step.slot'),
    value: slotValue,
    sub: slotSub,
  });

  const vatRate = sel.vatRate ?? 0;
  const gross =
    resolved.price != null && resolved.price > 0
      ? halalasToSarNumber(grossWithVat(resolved.price, vatRate))
      : null;
  const totalLabel =
    gross != null
      ? Intl.NumberFormat(dateLocale, { style: 'decimal', maximumFractionDigits: 2 }).format(gross)
      : null;

  return { rows, totalLabel, vatRate, isAr, t };
}

/** Sticky side panel (lg+): the booking slip that fills in as choices land. */
export function SummaryRail(sel: SummarySelection) {
  const { rows, totalLabel, vatRate, isAr, t } = useSummaryRows(sel);

  return (
    <aside
      aria-label={t('booking.summary.title')}
      className="sticky top-6 flex flex-col rounded-[1.25rem] p-5"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--accent) 28%, #FFFDF8) 0%, color-mix(in srgb, var(--accent) 14%, #FFFDF8) 100%)',
        border: '1px solid color-mix(in srgb, var(--accent-dark) 28%, transparent)',
        boxShadow: 'var(--sw-shadow-sm)',
      }}
    >
      <header className="flex flex-col gap-0.5 mb-4">
        <span
          className="text-[0.6875rem] font-semibold"
          style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
        >
          {isAr ? 'موعدك في مركز سواء' : 'Your Sawa appointment'}
        </span>
        <h2 className="text-base font-extrabold tracking-tight" style={{ color: 'var(--sw-secondary-700)' }}>
          {t('booking.summary.title')}
        </h2>
      </header>

      <dl className="flex flex-col">
        {rows.map((row, i) => {
          const filled = !!row.value;
          const editable = filled && !!sel.onEdit && row.screen !== sel.activeScreen;
          return (
            <div
              key={row.screen}
              className="flex items-start justify-between gap-3 py-3"
              style={{
                borderTop:
                  i === 0
                    ? 'none'
                    : '1px solid color-mix(in srgb, var(--accent-dark) 18%, transparent)',
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <dt
                  className="text-[0.6875rem] font-semibold"
                  style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
                >
                  {row.label}
                </dt>
                {filled ? (
                  <dd className="sw-row-in flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-sm font-bold leading-snug"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      {row.value}
                    </span>
                    {row.sub && (
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
                      >
                        {row.sub}
                      </span>
                    )}
                  </dd>
                ) : (
                  <dd
                    aria-hidden="true"
                    className="text-sm font-medium select-none"
                    style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 24%, transparent)' }}
                  >
                    —
                  </dd>
                )}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => sel.onEdit?.(row.screen)}
                  className="shrink-0 mt-0.5 text-[0.6875rem] font-bold rounded-full px-2.5 py-1 cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dark)_20%,transparent)]"
                  style={{ color: 'var(--primary-dark)' }}
                >
                  {isAr ? 'تغيير' : 'Change'}
                </button>
              )}
            </div>
          );
        })}
      </dl>

      <div
        className="flex items-baseline justify-between gap-3 pt-3.5 mt-1"
        style={{ borderTop: '1px dashed color-mix(in srgb, var(--accent-dark) 40%, transparent)' }}
      >
        <span
          className="text-[0.6875rem] font-bold"
          style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
        >
          {t('booking.summary.total')}
        </span>
        {totalLabel ? (
          <span className="sw-row-in flex flex-col items-end gap-0.5">
            <span className="flex items-baseline gap-1">
              <span
                className="text-xl font-extrabold tabular-nums leading-none"
                style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.01em' }}
              >
                {totalLabel}
              </span>
              <span
                className="text-[0.6875rem] font-semibold"
                style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
              >
                {t('booking.summary.currency')}
              </span>
            </span>
            {vatRate > 0 && (
              <span
                className="text-[0.625rem] font-medium"
                style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
              >
                {t('booking.price.inclVat')}
              </span>
            )}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="text-sm font-medium"
            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 24%, transparent)' }}
          >
            —
          </span>
        )}
      </div>

      <p
        className="flex items-center gap-1.5 mt-4 text-[0.6875rem] font-medium leading-relaxed"
        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 48%, transparent)' }}
      >
        <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="6" width="9" height="6" rx="1.5" />
          <path d="M4.5 6V4.5a2.5 2.5 0 1 1 5 0V6" />
        </svg>
        {isAr ? 'حجزك وبياناتك سرّية تماماً.' : 'Your booking and details stay fully private.'}
      </p>
    </aside>
  );
}

/** Compact chips strip (below lg): completed choices, tappable to change. */
export function SummaryChips(sel: SummarySelection) {
  const { rows } = useSummaryRows(sel);
  const filled = rows.filter((r) => r.value);
  if (filled.length === 0) return null;

  return (
    <div className="flex items-center gap-2 -mx-4 px-4 overflow-x-auto sw-no-scrollbar lg:hidden">
      {filled.map((row) => {
        const tappable = !!sel.onEdit && row.screen !== sel.activeScreen;
        const Tag = tappable ? 'button' : 'span';
        return (
          <Tag
            key={row.screen}
            {...(tappable
              ? { type: 'button' as const, onClick: () => sel.onEdit?.(row.screen) }
              : {})}
            className={`sw-row-in shrink-0 inline-flex items-center gap-1.5 ps-2.5 pe-3 py-1.5 rounded-full text-xs font-bold max-w-[60vw] ${tappable ? 'cursor-pointer' : ''}`}
            style={{
              background: 'color-mix(in srgb, var(--accent) 30%, #FFFDF8)',
              border: '1px solid color-mix(in srgb, var(--accent-dark) 30%, transparent)',
              color: 'var(--sw-secondary-700)',
            }}
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
            </svg>
            <span className="truncate">{row.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}
