import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }),
}));

import i18n from '@/i18n';
import { AppointmentClientCard } from '../AppointmentClientCard';

describe('AppointmentClientCard', () => {
  it('opens the client record when tapped', () => {
    const onPress = jest.fn();
    const view = render(<AppointmentClientCard name="Nora A" status="confirmed" statusLabel="Confirmed" onPress={onPress} />);
    expect(view.getByText(i18n.t('doctor.viewClientRecord'))).toBeTruthy();
    fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not a link when the booking has no client', () => {
    const view = render(<AppointmentClientCard name="x" status="confirmed" statusLabel="Confirmed" />);
    expect(view.queryByText(i18n.t('doctor.viewClientRecord'))).toBeNull();
  });
});
