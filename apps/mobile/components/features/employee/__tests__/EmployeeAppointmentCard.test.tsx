import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }),
}));

import i18n from '@/i18n';
import type { Booking } from '@/types/models';
import { EmployeeAppointmentCard } from '../EmployeeAppointmentCard';

const base = {
  id: 'b-1',
  status: 'confirmed',
  type: 'individual',
  startTime: '17:30',
  endTime: '18:15',
  client: { id: 'c-1', firstName: 'Nora', lastName: 'A' },
} as unknown as Booking;

describe('EmployeeAppointmentCard', () => {
  it('shows time, duration, client, service and delivery from the booking fields', () => {
    const onPress = jest.fn();
    const booking = { ...base, deliveryType: 'online', service: { nameAr: 'استشارة', nameEn: 'Consultation', duration: 45 } } as Booking;
    const view = render(<EmployeeAppointmentCard booking={booking} onPress={onPress} />);
    expect(view.getByText('17:30')).toBeTruthy();
    expect(view.getByText(i18n.t('doctor.durationMinutes', { count: 45 }))).toBeTruthy();
    expect(view.getByText('Nora A')).toBeTruthy();
    expect(view.getByText(`Consultation · ${i18n.t('doctor.deliveryOnline')}`)).toBeTruthy();
    fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits the service when the booking has none instead of inventing one', () => {
    const view = render(<EmployeeAppointmentCard booking={base} onPress={jest.fn()} />);
    expect(view.getByText(i18n.t('doctor.deliveryInPerson'))).toBeTruthy();
    // Duration falls back to the start/end range (45 minutes).
    expect(view.getByText(i18n.t('doctor.durationMinutes', { count: 45 }))).toBeTruthy();
  });
});
