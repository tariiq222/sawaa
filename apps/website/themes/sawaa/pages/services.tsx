import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { getLocale, t } from '@/features/locale/public';
import {
  getPublicCatalog,
  selectBookableClinicServices,
} from '@/features/public-catalog/public';
import { resolveSectionIntros } from '@/features/site-content/public';
import { listPublicEmployees } from '@/features/therapists/public';
import { ServicesDirectory } from '../components/services/services-directory';

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function SawaaServicesPage() {
  const [locale, catalog, employees] = await Promise.all([
    getLocale(),
    safeFetch(() => getPublicCatalog(), {
      departments: [],
      categories: [],
      services: [],
      vatRate: 0,
    }),
    safeFetch(() => listPublicEmployees(), []),
  ]);
  const intro = resolveSectionIntros(locale).services;
  const services = selectBookableClinicServices(catalog, employees);
  const countLabel = `${services.length} ${t(locale, 'services.page.count')}`;

  return (
    <>
      <section className="sw-section-mint relative overflow-hidden pb-16 pt-20 md:pb-20 md:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--sw-primary-400) 13%, transparent)' }}
        />
        <div className="relative mx-auto max-w-[880px] px-5 text-center sm:px-6 md:px-8">
          <span
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold"
            style={{
              background: 'color-mix(in srgb, var(--sw-primary-500) 9%, white)',
              color: 'var(--sw-primary-700)',
              border: '1px solid color-mix(in srgb, var(--sw-primary-500) 17%, transparent)',
            }}
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            {intro.tag}
          </span>
          <h1
            className="mb-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl"
            style={{ color: 'var(--sw-secondary-800)' }}
          >
            {intro.titlePrefix}{' '}
            <span style={{ color: 'var(--sw-primary-600)' }}>{intro.titleHighlight}</span>
          </h1>
          <p
            className="mx-auto max-w-[62ch] text-base leading-8 sm:text-lg"
            style={{ color: 'var(--sw-neutral-600)' }}
          >
            {intro.subtitle}
          </p>
          {services.length > 0 ? (
            <span
              className="mt-7 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold tabular-nums"
              style={{ color: 'var(--sw-primary-700)', boxShadow: 'var(--sw-shadow-xs)' }}
            >
              {countLabel}
            </span>
          ) : null}
        </div>
      </section>

      <section className="bg-white py-14 md:py-20">
        <div className="mx-auto max-w-[1260px] px-5 sm:px-6 md:px-8">
          {services.length > 0 ? (
            <ServicesDirectory services={services} vatRate={catalog.vatRate ?? 0} />
          ) : (
            <div className="mx-auto max-w-lg rounded-2xl px-8 py-12 text-center" style={{ background: 'var(--sw-primary-50)' }}>
              <Sparkles className="mx-auto mb-4 h-8 w-8" style={{ color: 'var(--sw-primary-600)' }} />
              <h2 className="mb-2 text-xl font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
                {t(locale, 'services.emptyTitle')}
              </h2>
              <p className="mb-6 text-sm leading-7" style={{ color: 'var(--sw-neutral-600)' }}>
                {t(locale, 'services.empty')}
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
                style={{ background: 'var(--sw-primary-700)', color: '#fff' }}
              >
                {t(locale, 'services.contact')}
                <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
