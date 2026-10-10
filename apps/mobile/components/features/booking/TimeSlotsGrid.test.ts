jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  FadeInDown: { delay: () => ({ duration: () => ({ easing: () => undefined }) }) },
  Easing: { out: () => undefined, cubic: undefined },
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

import { formatTime, slotGridLayout } from './TimeSlotsGrid';

it.each(['2026-09-28T16:00:00+03:00', '2026-09-28T13:00:00Z'])('formats the Riyadh slot %s in readable Arabic and English numerals', (atFour) => {
  expect(formatTime(atFour, false)).toBe('4:00 PM');
  expect(formatTime(atFour, true)).toBe('٤:٠٠ م');
});

import { sawaaSpacing } from '@/theme/sawaa/tokens';
it.each([0, 80, 288, 430])('keeps cells and gaps within available width %s', (width) => {
  for (const scale of [1, 2]) {
    const { columns, cellWidth } = slotGridLayout(width, scale);
    expect(Number.isInteger(columns)).toBe(true);
    expect(columns).toBeGreaterThanOrEqual(1);
    expect(cellWidth).toBeGreaterThanOrEqual(0);
    expect(columns * cellWidth + (columns - 1) * sawaaSpacing.sm).toBeLessThanOrEqual(width + 0.001);
  }
});
