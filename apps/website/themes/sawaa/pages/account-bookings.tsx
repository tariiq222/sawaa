import Link from 'next/link';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { ClientBookingsList } from '@/features/auth/client-bookings-list';

// Keep the route prop contract for theme callers; the list owns pagination in React Query.
export async function SawaaAccountBookingsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  void props.searchParams;
  const locale = await getLocale();

  return (
    <section
      className="sw-section-cream relative overflow-hidden px-5 pb-20 -mt-[88px] pt-[140px] sm:pt-[160px]"
      style={{ minHeight: '100vh' }}
    >
      <div
        className="absolute -top-24 -end-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 6%, transparent)' }}
        aria-hidden="true"
      />
      <div className="relative max-w-3xl mx-auto flex flex-col gap-6">
        <Link
          href="/account"
          className="text-sm font-semibold text-[var(--sw-primary-600)] hover:underline self-start"
        >
          ← {t(locale, 'account.backToAccount')}
        </Link>
        <header>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--sw-secondary-700)]">
            {t(locale, 'account.bookings')}
          </h1>
        </header>
        <ClientBookingsList locale={locale} />
      </div>
    </section>
  );
}
