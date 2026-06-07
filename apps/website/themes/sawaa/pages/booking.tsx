import BookingWizardPage from '@/app/booking/page';

export function SawaaBookingPage() {
  return (
    <section
      className="sw-section-mint relative overflow-hidden -mt-[88px] pt-[120px] sm:pt-[140px] pb-16"
      style={{ minHeight: '100vh' }}
    >
      <div className="relative">
        <BookingWizardPage />
      </div>
    </section>
  );
}