import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { BookingSummary } from './booking-summary';
import { LocaleProvider } from '@/features/locale/locale-provider';

const slot: AvailableSlot = {
  startTime: '2026-07-01T14:00:00.000Z',
  endTime: '2026-07-01T15:00:00.000Z',
};

const service: Service = {
  id: 'svc1',
  nameAr: 'استشارة',
  nameEn: 'Consultation',
  descriptionAr: null,
  descriptionEn: null,
  categoryId: 'cat1',
  price: 10000,
  duration: 60,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  bufferMinutes: 0,
  depositEnabled: false,
  depositPercent: null,
  maxParticipants: 1,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const employee: EmployeeWithUser = {
  id: 'emp1',
  userId: 'u1',
  specialty: null,
  specialtyAr: null,
  bio: null,
  bioAr: null,
  experience: 0,
  education: null,
  educationAr: null,
  rating: 0,
  reviewCount: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  nameAr: 'د. ليلى',
  nameEn: 'Dr. Layla',
  user: {
    id: 'u1',
    firstName: 'Layla',
    lastName: 'K.',
    email: 'l@sawa.test',
    phone: null,
    avatarUrl: null,
  },
};

function withLocale(children: ReactNode, locale: 'ar' | 'en' = 'en') {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

describe('BookingSummary', () => {
  it('renders the service name under en locale', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('Consultation')).toBeTruthy();
  });

  it('renders the therapist name', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
  });

  it('renders the gross total (price only when vatRate is 0)', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={vi.fn()}
        />,
      ),
    );
    // 10000 halalas / 100 = 100 SAR; Intl.NumberFormat in en-US with only
    // maximumFractionDigits:2 trims trailing zeros → "100", not "100.00".
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('renders the gross total with VAT applied', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          vatRate={0.15}
          onConfirm={vi.fn()}
        />,
      ),
    );
    // 10000 halalas + 15% VAT = 11500 → 115 SAR.
    expect(screen.getByText('115')).toBeTruthy();
    expect(screen.getByText(/incl\. VAT/i)).toBeTruthy();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={onConfirm}
        />,
      ),
    );
    // Button label is "Confirm & Pay" (en) — match the literal "Confirm" and
    // "Pay" tokens with any character between them.
    fireEvent.click(screen.getByRole('button', { name: /Confirm.*Pay/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('disables the confirm button while isSubmitting', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={vi.fn()}
          isSubmitting
        />,
      ),
    );
    const btn = screen.getByRole('button', { name: /Processing/i });
    expect(btn).toBeDisabled();
  });

  it('renders the service name in Arabic under ar locale', () => {
    render(
      withLocale(
        <BookingSummary
          service={service}
          employee={employee}
          slot={slot}
          totalHalalat={10000}
          onConfirm={vi.fn()}
        />,
        'ar',
      ),
    );
    expect(screen.getByText(/استشارة/)).toBeTruthy();
  });
});
