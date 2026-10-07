import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { DirState } from '@/hooks/useDir';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/ThemeProvider', () => require('@/theme/useTheme'));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => require('react').createElement(require('react-native').Pressable, props, children) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => { const animation = { delay: () => animation, duration: () => animation, easing: () => animation }; return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: () => undefined, cubic: undefined } }; });
import i18n from '@/i18n';
import { TimeSlotsGrid } from '../TimeSlotsGrid';
import { PaymentMethods } from '../PaymentMethods';
import { PackageBranchPicker } from '../../packages/PackageBranchPicker';

const dir: DirState = { locale: 'ar', isRTL: true, row: 'row-reverse', rowReverse: 'row', textAlign: 'right', alignStart: 'flex-end', alignEnd: 'flex-start', writingDirection: 'rtl', iconScaleX: -1 };

it('uses the selected language for slot guidance independently of layout direction', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  const screen = render(<TimeSlotsGrid loading={false} error={null} slots={[]} selectedIdx={null} onSelect={jest.fn()} dir={dir} f500="System" f600="System" />);
  expect(screen.getByText('No appointments available on this day')).toBeTruthy();
});
it('translates payment choices independently of RTL and exposes the selected radio label', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  const select = jest.fn();
  const screen = render(<PaymentMethods methods={['apple_pay', 'bank_transfer']} selected="bank_transfer" onSelect={select} dir={dir} />);
  expect(screen.getByRole('radio', { name: 'Bank transfer' })).toHaveProp('accessibilityState', { selected: true });
  expect(screen.getByText('Pay with one touch')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'Apple Pay' }));
  expect(select).toHaveBeenCalledWith('apple_pay');
});
it('announces the selected branch and offers a minimum 44pt retry action', () => {
  const screen = render(<PackageBranchPicker branches={[{ id: 'b1', nameAr: 'الفرع', nameEn: 'Branch', city: null, isMain: true, addressAr: null }]} branchId="b1" loading={false} error onSelect={jest.fn()} onRetry={jest.fn()} dir={dir} f400="System" f600="System" f700="System" />);
  expect(screen.getByRole('radio', { name: 'الفرع' })).toHaveProp('accessibilityState', { selected: true });
  expect(screen.getByRole('button', { name: 'Retry' })).toHaveStyle({ minHeight: 44 });
});
