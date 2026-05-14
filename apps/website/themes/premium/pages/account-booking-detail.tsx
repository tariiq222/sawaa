import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { BookingDetailFeature } from '@/features/account/booking-detail-feature';

interface PremiumAccountBookingDetailProps {
  bookingId: string;
}

export async function PremiumAccountBookingDetailPage({ bookingId }: PremiumAccountBookingDetailProps) {
  const locale = await getLocale();

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '2rem', fontSize: '1.75rem' }}>
        {t(locale, 'account.bookings')}
      </h1>
      <BookingDetailFeature bookingId={bookingId} locale={locale} />
    </main>
  );
}
