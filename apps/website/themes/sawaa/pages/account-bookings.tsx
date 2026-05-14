import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { getMyBookingsApi } from '@/features/auth/auth.api';
import { ClientBookingsList } from '@/features/auth/client-bookings-list';
import type { ClientBookingItem } from '@deqah/shared';

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
    // Not authenticated — page will redirect at the layout level
  }

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary-dark)', marginBottom: '2rem' }}>
        {t(locale, 'account.bookings')}
      </h1>
      <ClientBookingsList locale={locale} initialBookings={bookings} initialTotal={total} />
    </main>
  );
}
