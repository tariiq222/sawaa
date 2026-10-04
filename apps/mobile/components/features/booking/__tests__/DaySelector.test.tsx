import React from 'react';
import { render } from '@testing-library/react-native';

let mockIsRTL = true;

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/components/ui/LocalizedHorizontalScroll', () => ({
  LocalizedHorizontalScroll: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { DaySelector } from '../DaySelector';

const dir = () => ({
  locale: mockIsRTL ? 'ar' : 'en', isRTL: mockIsRTL, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr',
}) as unknown as React.ComponentProps<typeof DaySelector>['dir'];

function renderSelector() {
  return render(<DaySelector days={[new Date(2026, 9, 2)]} dayIdx={0} onSelect={jest.fn()} dir={dir()} f500="System" f700="System" />);
}

describe('DaySelector month header', () => {
  it('uses an Arabic-Indic year without a grouping separator in Arabic', () => {
    mockIsRTL = true;
    const screen = renderSelector();
    expect(screen.getByText('أكتوبر ٢٠٢٦')).toBeTruthy();
  });

  it('keeps the Latin year in English', () => {
    mockIsRTL = false;
    const screen = renderSelector();
    expect(screen.getByText('Oct 2026')).toBeTruthy();
  });
});
