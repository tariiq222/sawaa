'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { halalasToSar } from '@/lib/money';
import { safeImageSrc } from '@/lib/image-url';
import { packageGrossPrice, type PublicPackageFamily } from './packages.api';

function localized(ar: string | null | undefined, en: string | null | undefined, locale: string) {
  return locale === 'ar' ? ar || en || '' : en || ar || '';
}

export function PackageCatalogFeature({
  families,
  loadFailed = false,
}: {
  families: PublicPackageFamily[];
  loadFailed?: boolean;
}) {
  const locale = useLocale();
  const t = useT();

  if (loadFailed) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-[var(--sw-neutral-200)] bg-[var(--surface)] p-8 text-center shadow-[var(--sw-shadow-xs)]"
      >
        <h2 className="text-lg font-extrabold text-[var(--sw-secondary-700)]">
          {t('packages.loadFailedTitle')}
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--sw-body)]">{t('packages.loadFailed')}</p>
      </div>
    );
  }

  if (families.length === 0) {
    return <p role="status">{t('packages.none')}</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2" aria-label={t('packages.available')}>
      {families.map((family) => {
        const options = family.options.filter((option) => option.isActive && option.isPublic);
        let lowest: number | null = null;
        let lowestSessions: number | null = null;
        for (const option of options) {
          const price = option.price?.finalPrice ?? 0;
          if (lowest === null || price < lowest) {
            lowest = price;
            lowestSessions = option.sessionCount;
          }
        }
        const image = safeImageSrc(family.imageUrl ?? null);
        return (
          <article
            key={family.id}
            className="overflow-hidden rounded-3xl border border-[var(--sw-neutral-200)] bg-[var(--surface)] shadow-[var(--sw-shadow-xs)]"
          >
            {image ? (
              <span className="relative block aspect-[3/2] w-full bg-[var(--sw-primary-50)]">
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                  aria-hidden
                />
              </span>
            ) : null}
            <div className="p-6">
              <h2 className="text-xl font-extrabold text-[var(--sw-secondary-700)]">
                {localized(family.nameAr, family.nameEn, locale)}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--sw-body)]">
                {localized(family.descriptionAr, family.descriptionEn, locale)}
              </p>
              <p className="mt-4 text-sm font-bold text-[var(--sw-primary-700)]">
                {t('packages.from')}{' '}
                {lowest === null
                  ? '—'
                  : `${halalasToSar(packageGrossPrice(lowest, family.vatRate))} ${locale === 'ar' ? 'ر.س' : 'SAR'}`}
                {lowest !== null && (family.vatRate ?? 0) > 0 ? ` (${t('packages.inclVat')})` : null}
                {lowestSessions !== null
                  ? ` · ${lowestSessions} ${t(lowestSessions === 1 ? 'packages.sessionsUnit.one' : lowestSessions === 2 ? 'packages.sessionsUnit.two' : lowestSessions <= 10 ? 'packages.sessionsUnit.many' : 'packages.sessionsUnit.other')}`
                  : null}
              </p>
              <Link
                href={`/packages/${encodeURIComponent(family.id)}`}
                className="mt-5 inline-flex rounded-full bg-[var(--sw-primary-500)] px-5 py-3 text-sm font-bold text-[var(--on-primary)]"
              >
                {t('packages.view')}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
