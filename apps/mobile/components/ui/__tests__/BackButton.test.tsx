import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockRTL = true;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ glass: { opaqueBg: '#fff' }, ink: { 700: '#000' } }),
}));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ isRTL: mockRTL }),
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, ...props }: React.PropsWithChildren<{ onPress?: () => void }>) => (
    require('react').createElement(require('react-native').Pressable, { onPress, ...props }, children)
  ),
}));
jest.mock('lucide-react-native', () => ({
  ChevronLeft: () => require('react').createElement(require('react-native').Text, null, 'left'),
  ChevronRight: () => require('react').createElement(require('react-native').Text, null, 'right'),
}));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

import { BackButton } from '../BackButton';

describe('BackButton', () => {
  beforeEach(() => { mockRTL = true; });

  it('uses the logical RTL back icon and invokes the callback', () => {
    const onPress = jest.fn();
    const screen = render(<BackButton onPress={onPress} />);

    expect(screen.getByText('right')).toBeTruthy();
    expect(screen.getByRole('button')).toHaveProp('accessibilityLabel', 'a11y.buttonBack');
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('allows a route-specific accessibility label', () => {
    const screen = render(<BackButton onPress={jest.fn()} accessibilityLabel="Close details" />);

    expect(screen.getByRole('button')).toHaveProp('accessibilityLabel', 'Close details');
  });

  it('uses the left arrow in LTR layout', () => {
    mockRTL = false;
    const screen = render(<BackButton onPress={jest.fn()} />);

    expect(screen.getByText('left')).toBeTruthy();
  });

  it('uses the shared translucent glass surface without an opaque fill', () => {
    const screen = render(<BackButton onPress={jest.fn()} />);
    const button = screen.getByRole('button');

    expect(button).toHaveProp('variant', 'regular');
    expect(button).toHaveProp('radius', 22);
    expect(button).not.toHaveStyle({ backgroundColor: '#fff' });
  });
});
