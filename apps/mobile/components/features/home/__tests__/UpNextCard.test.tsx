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
jest.mock('@/components/features/JoinVideoCallButton', () => ({
  JoinVideoCallButton: (props: { url: string | null; durationMins: number; status: string | null }) => {
    const { Text } = require('react-native');
    return <Text>{`join:${props.url}:${props.durationMins}:${props.status}`}</Text>;
  },
}));
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
  expect(screen.getByText(/4:00 PM/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /home.upcomingAppointment:/ }));
  expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/same-appointment');
});

it('reads legacy Riyadh wall time without interpreting it as UTC', () => {
  const homeRow = JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow;
  delete homeRow.scheduledAt;
  const screen = render(<UpNextCard loading={false} booking={homeRow} dir={dir} f600="System" f700="System" />);
  expect(screen.getByText(/4:00 PM/)).toBeTruthy();
});


it('shows the Gregorian day and Riyadh time in Arabic', () => {
  const homeRow = JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow;
  const screen = render(<UpNextCard loading={false} booking={homeRow} dir={buildDirState('ar')} f600="System" f700="System" />);
  expect(screen.getByText(/٤:٠٠ م/)).toBeTruthy();
  expect(screen.getByText('٩')).toBeTruthy();
});

const liveRow = (overrides: Partial<PortalBookingRow> = {}) => ({
  ...(JSON.parse(JSON.stringify(mapBookingRow(booking, relations))) as PortalBookingRow),
  type: 'in_person', deliveryType: 'online', zoomJoinUrl: 'https://zoom.example/j/1', zoomMeetingStatus: 'CREATED', ...overrides,
} as PortalBookingRow);
const duringSession = Date.parse('2026-10-09T13:20:00Z');

it('shows the live label, pill and join button while the session is in progress', () => {
  const screen = render(<UpNextCard loading={false} booking={liveRow()} now={duringSession} dir={dir} f600="System" f700="System" />);
  expect(screen.getByText('home.liveLabel')).toBeTruthy();
  expect(screen.getByText('home.liveNow')).toBeTruthy();
  expect(screen.getByText(/4:00 PM – 5:00 PM/)).toBeTruthy();
  expect(screen.getByText('join:https://zoom.example/j/1:60:CREATED')).toBeTruthy();
  expect(screen.queryByText('home.upcomingAppointment')).toBeNull();
});

it('does not render a join button for an in-person live session', () => {
  const screen = render(<UpNextCard loading={false} booking={liveRow({ deliveryType: 'in_person' })} now={duringSession} dir={dir} f600="System" f700="System" />);
  expect(screen.getByText('home.liveNow')).toBeTruthy();
  expect(screen.queryByText(/^join:/)).toBeNull();
});

it('shows the status pill and no join button before the session starts', () => {
  const screen = render(<UpNextCard loading={false} booking={liveRow({ status: 'pending' })} now={Date.parse('2026-10-09T10:00:00Z')} dir={dir} f600="System" f700="System" />);
  expect(screen.getByText('home.upcomingAppointment')).toBeTruthy();
  expect(screen.getByText('appointments.pending')).toBeTruthy();
  expect(screen.queryByText(/^join:/)).toBeNull();
});
