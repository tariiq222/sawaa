import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { mapBookingRow } from '../../../../../backend/src/modules/bookings/booking-row.mapper';
import { formatTimeOfDay } from '@/lib/session-format';
import { buildDirState } from '@/hooks/useDir';
import type { PortalBookingRow } from '@/services/client/portal';
import { UpNextCard } from '../UpNextCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => children }));

const dir = buildDirState('en');
const booking = {
  id: 'same-appointment', clientId: 'client-1', employeeId: 'employee-1', serviceId: null,
  scheduledAt: new Date('2026-10-09T13:00:00Z'), endsAt: new Date('2026-10-09T14:00:00Z'),
  status: 'CONFIRMED', bookingType: 'INDIVIDUAL', deliveryType: 'IN_PERSON',
  createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
} as Parameters<typeof mapBookingRow>[0];
const relations = { clientsById: new Map(), employeesById: new Map(), servicesById: new Map(), paymentsByBookingId: new Map() };

it('uses the real home serializer and the detail formatter to show the same 4pm appointment', () => {
  const homeRow = JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow;
  const screen = render(<UpNextCard loading={false} booking={homeRow} dir={dir} f600="System" f700="System" />);
  expect(formatTimeOfDay(booking.scheduledAt.toISOString(), false)).toBe('4:00 PM');
  expect(screen.getByText('4:00 PM')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /home.upcomingAppointment:/ }));
  expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/same-appointment');
});

it('reads legacy Riyadh wall time without interpreting it as UTC', () => {
  const homeRow = JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow;
  delete homeRow.scheduledAt;
  const screen = render(<UpNextCard loading={false} booking={homeRow} dir={dir} f600="System" f700="System" />);
  expect(screen.getByText('4:00 PM')).toBeTruthy();
});


it('shows the Gregorian day and Riyadh time in Arabic', () => {
  const homeRow = JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow;
  const screen = render(<UpNextCard loading={false} booking={homeRow} dir={buildDirState('ar')} f600="System" f700="System" />);
  expect(screen.getByText('٤:٠٠ م')).toBeTruthy();
  expect(screen.getByText('٩')).toBeTruthy();
});
