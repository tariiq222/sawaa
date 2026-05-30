import Link from 'next/link';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { ClientBookingsList } from '@/features/auth/client-bookings-list';
import type { ClientBookingItem } from '@sawaa/shared';

interface AccountBookingsPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export async function SawaaAccountBookingsPage({ searchParams }: AccountBookingsPageProps) {
  const locale = await getLocale();
  const { page = '1', pageSize = '10' } = await searchParams;

  let bookings: ClientBookingItem[] = [];
  let total = 0;
  try {
    const result = await getMyBookingsApi(parseInt(page), parseInt(pageSize));
    bookings = result.items;
    total = result.total;
  } catch {
    // not authenticated — auth-guard redirects elsewhere
  }

  return (
    <section
      className="sw-section-cream relative overflow-hidden px-5 pb-20 pt-28 sm:pt-32"
      style={{ minHeight: 'calc(100vh - 120px)' }}
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
        <ClientBookingsList locale={locale} initialBookings={bookings} initialTotal={total} />
      </div>
    </section>
  );
}
