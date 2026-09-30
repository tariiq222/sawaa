jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  FadeInDown: { delay: () => ({ duration: () => ({ easing: () => undefined }) }) },
  Easing: { out: () => undefined, cubic: undefined },
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

import { formatTime } from './TimeSlotsGrid';

it('formats the same local slot in readable Arabic and English numerals', () => {
  const atFour = new Date(2026, 8, 28, 16, 0).toISOString();
  expect(formatTime(atFour, false)).toBe('4:00 PM');
  expect(formatTime(atFour, true)).toBe('٤:٠٠ م');
});
