import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Clock } from 'lucide-react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 10 }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('@/components/ui/BackButton', () => ({
  BackButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable accessibilityLabel="back" onPress={onPress}><Text>back</Text></Pressable>;
  },
}));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

import { Chip } from '../Chip';
import { FloatingCta } from '../FloatingCta';
import { InfoRows } from '../InfoRows';
import { Pill } from '../Pill';
import { ScreenHeader } from '../ScreenHeader';
import { SectionHeader } from '../SectionHeader';
import { Thumb } from '../Thumb';

describe('redesign primitives', () => {
  it('ScreenHeader centres a header-role title and forwards back presses', () => {
    const onBack = jest.fn();
    const screen = render(<ScreenHeader title="الأخصائيون" onBack={onBack} />);
    expect(screen.getByRole('header')).toHaveTextContent('الأخصائيون');
    fireEvent.press(screen.getByLabelText('back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('SectionHeader only shows the action when it has both a label and a handler', () => {
    const onAction = jest.fn();
    const withAction = render(<SectionHeader title="العيادات" actionLabel="عرض الكل" onActionPress={onAction} />);
    fireEvent.press(withAction.getByText('عرض الكل'));
    expect(onAction).toHaveBeenCalledTimes(1);
    const plain = render(<SectionHeader title="العيادات" actionLabel="عرض الكل" />);
    expect(plain.queryByText('عرض الكل')).toBeNull();
  });

  it('Chip reports its selected state and presses', () => {
    const onPress = jest.fn();
    const screen = render(<Chip label="عن بعد" selected onPress={onPress} />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveProp('accessibilityState', { selected: true, disabled: false });
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Chip does not press when disabled', () => {
    const onPress = jest.fn();
    const screen = render(<Chip label="عن بعد" disabled onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('Pill renders its label in every tone', () => {
    for (const tone of ['brand', 'amber', 'muted'] as const) {
      const screen = render(<Pill label="حضوري" tone={tone} />);
      expect(screen.getByText('حضوري')).toBeTruthy();
    }
  });

  it('Thumb shows the photo when it has a uri and a hidden placeholder when it does not', () => {
    const photo = render(<Thumb uri="https://cdn.example/a.jpg" width={88} height={88} accessibilityLabel="صورة" />);
    expect(photo.getByLabelText('صورة')).toBeTruthy();
    const placeholder = render(<Thumb width={88} height={88} />);
    expect(placeholder.queryByLabelText('صورة')).toBeNull();
  });

  it('InfoRows lists each label and value', () => {
    const screen = render(<InfoRows rows={[{ icon: Clock, label: 'المدة', value: '50 دقيقة' }, { icon: Clock, label: 'الوقت', value: '5:30 م' }]} />);
    for (const text of ['المدة', '50 دقيقة', 'الوقت', '5:30 م']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('FloatingCta renders its children', () => {
    const screen = render(<FloatingCta><Pill label="احجز" /></FloatingCta>);
    expect(screen.getByText('احجز')).toBeTruthy();
  });
});

it('reports changing footer height including its full wrapper', () => {
  const onHeightChange = jest.fn();
  const view = render(<FloatingCta onHeightChange={onHeightChange}><Text>Continue</Text></FloatingCta>);
  for (const height of [140, 200, 0]) fireEvent(view.getByTestId('floating-cta'), 'layout', { nativeEvent: { layout: { width: 320, height, x: 0, y: 0 } } });
  expect(onHeightChange.mock.calls).toEqual([[140], [200]]);
});
