import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { getSawaaColors, sawaaColors, withAlpha } from '@/theme/sawaa/tokens';
import { buildTheme } from '@/theme/tokens';

const mockDark = getSawaaColors('dark');
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, mockScheme), scheme: mockScheme }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View },
  useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (factory: () => unknown) => factory(),
  withTiming: (value: number) => value, withRepeat: (value: number) => value,
  Easing: { out: () => undefined, cubic: undefined },
}));
let mockPalette = sawaaColors as typeof mockDark;
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => mockPalette }));
jest.mock('@/theme', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', writingDirection: 'ltr' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null }));

import { EmptyState } from '../ui/EmptyState';
import { Avatar } from '../ui/Avatar';
import { LabeledInput } from '../ui/LabeledInput';
import type { DirState } from '@/hooks/useDir';
import { Skeleton } from '../ui/Skeleton';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusPill } from '../ui/StatusPill';

beforeEach(() => { mockPalette = sawaaColors; mockScheme = 'light'; });

it('updates empty title and supporting copy when appearance changes', () => {
  const view = render(<EmptyState icon="alert" title="No appointments" description="Try another day" />);
  expect(StyleSheet.flatten(view.getByText('No appointments').props.style).color).toBe(sawaaColors.ink[900]);
  mockPalette = mockDark;
  view.rerender(<EmptyState icon="alert" title="No appointments" description="Try another day" />);
  expect(StyleSheet.flatten(view.getByText('No appointments').props.style).color).toBe(mockDark.ink[900]);
  expect(StyleSheet.flatten(view.getByText('Try another day').props.style).color).toBe(mockDark.ink[500]);
});

it('uses appearance-aware initials and preserves caller color overrides', () => {
  mockPalette = mockDark;
  const view = render(<Avatar name="Test Person" />);
  expect(StyleSheet.flatten(view.getByText('TP').props.style).color).toBe(mockDark.teal[700]);
  view.rerender(<Avatar name="Test Person" color="purple" />);
  expect(StyleSheet.flatten(view.getByText('TP').props.style).color).toBe('purple');
});

it('updates input text and placeholder without changing its value', () => {
  const dir = { textAlign: 'left', row: 'row' } as DirState;
  const view = render(<LabeledInput label="Name" value="Test" placeholder="Your name" onChangeText={jest.fn()} dir={dir} />);
  mockPalette = mockDark;
  view.rerender(<LabeledInput label="Name" value="Test" placeholder="Your name" onChangeText={jest.fn()} dir={dir} />);
  const input = view.UNSAFE_getByType(TextInput);
  expect(input.props.value).toBe('Test');
  expect(input.props.placeholderTextColor).toBe(mockDark.ink[500]);
  expect(StyleSheet.flatten(input.props.style).color).toBe(mockDark.ink[900]);
});

it('updates reduced-motion skeleton fill on appearance change', () => {
  const view = render(<Skeleton />);
  mockPalette = mockDark;
  view.rerender(<Skeleton />);
  expect(StyleSheet.flatten(view.UNSAFE_getByType(View).props.style).backgroundColor).toBe(withAlpha(mockDark.ink[900], 0.12));
});

it('updates progress colors while retaining bounded accessible progress', () => {
  const view = render(<ProgressBar progress={2} />);
  mockPalette = mockDark;
  view.rerender(<ProgressBar progress={2} />);
  const track = view.getByRole('progressbar');
  expect(track.props.accessibilityValue).toEqual({ min: 0, max: 1, now: 1 });
  expect(StyleSheet.flatten(track.props.style).backgroundColor).toBe(withAlpha(mockDark.teal[700], 0.12));
});

it('uses dark status colors and preserves its visible status label', () => {
  const view = render(<StatusPill status="paid" label="Paid" />);
  mockScheme = 'dark';
  view.rerender(<StatusPill status="paid" label="Paid" />);
  expect(StyleSheet.flatten(view.getByText('Paid').props.style).color).toBe(buildTheme(null, 'dark').colors.payment.paid);
});
