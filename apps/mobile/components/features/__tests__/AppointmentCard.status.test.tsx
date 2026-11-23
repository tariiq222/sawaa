import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: require('@/theme/tokens').buildTheme(null, 'light'),
    scheme: 'light',
  }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({
    locale: 'en',
    isRTL: false,
    row: 'row',
    textAlign: 'left',
    alignStart: 'flex-start',
    writingDirection: 'ltr',
  }),
}));

import i18n from '@/i18n';
import type { Booking } from '@/types/models';
import type { BookingStatus } from '@/types/booking-enums';
import { AppointmentCard } from '../AppointmentCard';

/**
 * Literal expected strings, deliberately NOT derived from STATUS_LABEL_MAP.
 *
 * Deriving the expectation from the same map the component reads makes the
 * test a tautology: changing `no_show` to point at `appointments.pending`
 * would keep it green. These are the actual English strings, so a wrong key
 * fails here.
 *
 * The card used to keep its own six-entry map, so four statuses fell through
 * to the raw wire value.
 */
const EXPECTED: Record<BookingStatus, string> = {
  pending: 'Pending Confirmation',
  pending_group_fill: 'Pending Confirmation',
  awaiting_payment: 'Pending Confirmation',
  confirmed: 'Confirmed',
  // Must NOT read "Confirmed": only the deposit has been paid.
  deposit_paid: 'Confirmed with deposit',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancel_requested: 'Pending Cancellation',
  no_show: 'No Show',
  expired: 'Expired',
};

function booking(status: BookingStatus): Booking {
  return {
    id: 'b-1',
    status,
    type: 'individual',
    date: '2026-11-20T10:00:00.000Z',
    amount: 0,
    employee: { user: { firstName: 'Nora', lastName: 'A' } },
  } as unknown as Booking;
}

describe('AppointmentCard status labels', () => {
  // Pin the language so the literal strings below are stable regardless of the
  // machine's default (the app defaults to Arabic).
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  it.each(Object.entries(EXPECTED))('renders %s as %j', (status, expected) => {
    const view = render(
      <AppointmentCard booking={booking(status as BookingStatus)} onPress={jest.fn()} />,
    );
    expect(view.getByText(expected)).toBeTruthy();
    view.unmount();
  });

  it('distinguishes cancelled from cancelledStatus in Arabic', async () => {
    // English can't tell them apart ("Cancelled" for both), so a repointed key
    // would slip through the English loop above. Arabic can: ملغي vs الملغاة.
    await i18n.changeLanguage('ar');
    const view = render(<AppointmentCard booking={booking('cancelled')} onPress={jest.fn()} />);
    expect(view.getByText('ملغي')).toBeTruthy();
    expect(view.queryByText('الملغاة')).toBeNull();
    view.unmount();
    await i18n.changeLanguage('en');
  });

  it('never falls back to the raw wire value', () => {
    for (const status of Object.keys(EXPECTED) as BookingStatus[]) {
      const view = render(<AppointmentCard booking={booking(status)} onPress={jest.fn()} />);
      expect(view.queryByText(status)).toBeNull();
      view.unmount();
    }
  });
});
