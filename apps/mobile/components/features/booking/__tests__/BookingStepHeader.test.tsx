import React from 'react';
import { render } from '@testing-library/react-native';

let mockIsRTL = true;

jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: mockIsRTL ? 'ar' : 'en', isRTL: mockIsRTL, row: 'row', textAlign: 'left', writingDirection: 'ltr' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/components/ui/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { step: string; total: string }) => (key === 'booking.stepOf' ? `الخطوة ${vars?.step} من ${vars?.total}` : key),
  }),
}));

import { BookingStepHeader } from '../BookingStepHeader';

describe('BookingStepHeader', () => {
  it('shows Arabic-Indic digits in Arabic and one progress segment per step', () => {
    mockIsRTL = true;
    const screen = render(<BookingStepHeader step={3} total={4} title="t" onBack={jest.fn()} />);
    expect(screen.getByText('الخطوة ٣ من ٤')).toBeTruthy();
    const bar = screen.UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(bar.props.children).toHaveLength(4);
    expect(bar.props.accessibilityValue).toMatchObject({ min: 1, max: 4, now: 3 });
  });

  it('keeps Latin digits in English', () => {
    mockIsRTL = false;
    const screen = render(<BookingStepHeader step={2} total={3} title="t" onBack={jest.fn()} />);
    expect(screen.getByText('الخطوة 2 من 3')).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'progressbar' }).props.children).toHaveLength(3);
  });
});
