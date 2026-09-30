import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress}>{children}</Pressable>;
} }));
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/hooks/queries', () => ({ usePackageFamilies: () => ({ data: [], isLoading: false, isError: false }) }));

import PackagesIndexScreen from '../index';

it('keeps package balance reachable from the package catalog', () => {
  const screen = render(<PackagesIndexScreen />);
  fireEvent.press(screen.getByText('packages.balance'));
  expect(mockPush).toHaveBeenCalledWith('/(client)/packages/purchases');
});
