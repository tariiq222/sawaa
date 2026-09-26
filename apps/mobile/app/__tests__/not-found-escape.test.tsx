import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockCanGoBack = false;
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/PrimaryButton', () => {
  const { Pressable, Text } = require('react-native');
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end', writingDirection: 'rtl' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));

import NotFoundScreen from '../+not-found';

describe('unmatched route screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it('offers the public home when the unknown link opened the app cold', () => {
    const screen = render(<NotFoundScreen />);

    fireEvent.press(screen.getByLabelText('notFound.back'));

    expect(mockReplace).toHaveBeenCalledWith('/home');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('returns to the previous screen when there is history', () => {
    mockCanGoBack = true;
    const screen = render(<NotFoundScreen />);

    fireEvent.press(screen.getByLabelText('notFound.back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
