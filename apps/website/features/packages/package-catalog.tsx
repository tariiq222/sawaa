'use client';

import Link from 'next/link';
import type { PackageFamily } from '@sawaa/shared/types';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { halalasToSar } from '@/lib/money';

function localized(ar: string | null | undefined, en: string | null | undefined, locale: string) {
  return locale === 'ar' ? ar || en || '' : en || ar || '';
}

export function PackageCatalogFeature({ families }: { families: PackageFamily[] }) {
  const locale = useLocale();
  const t = useT();
  if (families.length === 0) {
    return <p role="status">{t('packages.none')}</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2" aria-label={t('packages.available')}>
      {families.map((family) => {
        const options = family.options.filter((option) => option.isActive && option.isPublic);
        const lowest = options.reduce<number | null>((value, option) => {
          const price = option.price?.finalPrice ?? 0;
          return value === null ? price : Math.min(value, price);
        }, null);
        return (
          <article key={family.id} className="rounded-3xl border border-[var(--sw-neutral-200)] bg-[var(--surface)] p-6 shadow-[var(--sw-shadow-xs)]">
            <h2 className="text-xl font-extrabold text-[var(--sw-secondary-700)]">
              {localized(family.nameAr, family.nameEn, locale)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--sw-body)]">
              {localized(family.descriptionAr, family.descriptionEn, locale)}
            </p>
            <p className="mt-4 text-sm font-bold text-[var(--sw-primary-700)]">
              {t('packages.from')} {lowest === null ? '—' : `${halalasToSar(lowest)} ${locale === 'ar' ? 'ر.س' : 'SAR'}`}
            </p>
            <Link
              href={`/packages/${encodeURIComponent(family.id)}`}
              className="mt-5 inline-flex rounded-full bg-[var(--sw-primary-500)] px-5 py-3 text-sm font-bold text-[var(--on-primary)]"
            >
              {t('packages.view')}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
