'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { halalasToSar } from '@/lib/money';
import { packageGrossPrice, type PublicPackageFamily } from './packages.api';

export function PackageDetailFeature({ family }: { family: PublicPackageFamily }) {
  const locale = useLocale();
  const t = useT();
  const options = family.options.filter((option) => option.isActive && option.isPublic);
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? '');
  const selected = options.find((option) => option.id === selectedId) ?? options[0];
  if (!selected) return <p role="status">{t('packages.noOptions')}</p>;
  const vatRate = family.vatRate ?? 0;
  const currency = locale === 'ar' ? 'ر.س' : 'SAR';
  const money = `${halalasToSar(packageGrossPrice(selected.price.finalPrice, vatRate))} ${currency}`;
  const purchaseHref = `/packages/purchase?packageId=${encodeURIComponent(selected.id)}&packageFamilyId=${encodeURIComponent(family.id)}`;

  return (
    <section className="mx-auto max-w-3xl rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--sw-shadow-sm)] sm:p-8">
      <Link href="/packages" className="text-sm font-bold text-[var(--sw-primary-700)]">{t('packages.all')}</Link>
      <h1 className="mt-4 text-3xl font-black text-[var(--sw-secondary-700)]">
        {locale === 'ar' ? family.nameAr : family.nameEn || family.nameAr}
      </h1>
      <p className="mt-3 leading-7 text-[var(--sw-body)]">{locale === 'ar' ? family.descriptionAr : family.descriptionEn || family.descriptionAr}</p>
      <p className="mt-4 text-sm font-bold text-[var(--sw-primary-700)]">{selected.sessionCount} {locale === 'ar' ? 'جلسة' : 'sessions'}</p>
      {selected.displayGroups?.length ? (
        <ul className="mt-4 space-y-2 text-sm text-[var(--sw-body)]" aria-label={locale === 'ar' ? 'تفاصيل الجلسات' : 'Session details'}>
          {selected.displayGroups.map((group) => {
            const serviceName = locale === 'ar' ? group.serviceNameAr : group.serviceNameEn || group.serviceNameAr;
            const deliveryLabel = (deliveryType: 'IN_PERSON' | 'ONLINE') => deliveryType === 'ONLINE'
              ? (locale === 'ar' ? 'عن بُعد' : 'Online')
              : (locale === 'ar' ? 'حضوري' : 'In person');
            const sessionLabel = (session: (typeof group.sessions)[number]) => `${session.durationMins} ${locale === 'ar' ? 'دقيقة' : 'min'} · ${deliveryLabel(session.deliveryType)}`;
            return <li key={group.key}>{group.label || serviceName} · {group.employeeName} · {group.sessions.length} {locale === 'ar' ? 'جلسات' : 'sessions'} ({group.sessions.map(sessionLabel).join(', ')})</li>;
          })}
        </ul>
      ) : selected.groups?.length ? (
        <ul className="mt-4 space-y-2 text-sm text-[var(--sw-body)]" aria-label={locale === 'ar' ? 'تفاصيل الجلسات' : 'Session details'}>
          {selected.groups.map((group) => <li key={group.key}>{group.label || group.key}: {group.sessions.length} {locale === 'ar' ? 'جلسات' : 'sessions'}</li>)}
        </ul>
      ) : null}
      <fieldset className="mt-7 space-y-3">
        <legend className="mb-3 text-sm font-bold text-[var(--sw-secondary-700)]">
          {t('packages.chooseCount')}
        </legend>
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[var(--sw-neutral-200)] p-4 has-[:checked]:border-[var(--sw-primary-500)] has-[:checked]:bg-[var(--sw-primary-50)]">
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="package-option"
                value={option.id}
                checked={option.id === selectedId}
                onChange={() => setSelectedId(option.id)}
              />
              <span className="font-bold text-[var(--sw-secondary-700)]">{locale === 'ar' ? option.nameAr : option.nameEn || option.nameAr}</span>
            </span>
            <span className="font-bold text-[var(--sw-primary-700)]">{halalasToSar(packageGrossPrice(option.price.finalPrice, vatRate))} {currency}</span>
          </label>
        ))}
      </fieldset>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg font-black text-[var(--sw-secondary-700)]">
          {money}
          {vatRate > 0 && <span className="ms-2 text-xs font-medium text-[var(--sw-body)]">{t('packages.inclVat')}</span>}
        </p>
        <Link href={purchaseHref} className="rounded-full bg-[var(--sw-primary-500)] px-6 py-3 font-bold text-[var(--on-primary)]">
          {t('packages.continue')}
        </Link>
      </div>
    </section>
  );
}
