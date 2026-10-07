import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: require('react-native').View }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: require('react-native').View }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

const mockRefetch = jest.fn();
let mockQuery: { data?: { items: unknown[]; meta?: { total: number; page: number; totalPages: number } }; isPending: boolean; isError: boolean };
const mockUseClientBookings = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useClientBookings: (params: unknown) => {
    mockUseClientBookings(params);
    return { ...mockQuery, refetch: mockRefetch };
  },
}));

import RecordsScreen from '../records';

describe('records screen states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true;
    mockQuery = { data: undefined, isPending: false, isError: false };
  });

  it('requests completed appointments through the shared bookings query', () => {
    render(<RecordsScreen />);
    expect(mockUseClientBookings).toHaveBeenCalledWith({ status: 'completed', limit: 50, page: 1 });
  });

  it('shows neither the empty state nor the error while loading', () => {
    mockQuery = { isPending: true, isError: false };
    const screen = render(<RecordsScreen />);
    expect(screen.queryByText('records.empty')).toBeNull();
    expect(screen.queryByText('records.loadError')).toBeNull();
  });

  it('shows a retryable error instead of the empty state when loading fails', () => {
    mockQuery = { isPending: false, isError: true };
    const screen = render(<RecordsScreen />);
    expect(screen.getByText('records.loadError')).toBeTruthy();
    expect(screen.queryByText('records.empty')).toBeNull();
    fireEvent.press(screen.getByText('common.retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no completed sessions', () => {
    mockQuery = { data: { items: [] }, isPending: false, isError: false };
    const screen = render(<RecordsScreen />);
    expect(screen.getByText('records.empty')).toBeTruthy();
    expect(screen.getByText('records.emptyHint')).toBeTruthy();
  });

  it('lists completed sessions and opens the appointment detail', () => {
    mockQuery = {
      data: {
        items: [{
          id: 'b-1', scheduledAt: '2026-09-01T10:00:00.000Z', deliveryType: 'IN_PERSON',
          employee: { nameAr: 'سارة', nameEn: 'Sara' }, service: { nameAr: 'إرشاد أسري', nameEn: 'Family counseling' },
        }],
      },
      isPending: false,
      isError: false,
    };
    const screen = render(<RecordsScreen />);
    fireEvent.press(screen.getByText('سارة'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/b-1');
  });

  it('reaches records after the first 50 while retaining the completed filter and retrying page 2', () => {
    mockQuery = { data: { items: Array.from({ length: 50 }, (_, i) => ({ id: `b-${i}`, scheduledAt: '2026-09-01T10:00:00.000Z', employee: { nameEn: `Person ${i}` } })), meta: { total: 51, page: 1, totalPages: 2 } }, isPending: false, isError: false };
    const screen = render(<RecordsScreen />);
    fireEvent.press(screen.getByText('common.next'));
    expect(mockUseClientBookings).toHaveBeenLastCalledWith({ status: 'completed', limit: 50, page: 2 });
    mockQuery = { isPending: false, isError: true };
    screen.rerender(<RecordsScreen />);
    fireEvent.press(screen.getByText('common.retry'));
    expect(mockRefetch).toHaveBeenCalled();
    expect(mockUseClientBookings).toHaveBeenLastCalledWith({ status: 'completed', limit: 50, page: 2 });
    mockQuery = { data: { items: [{ id: 'b-50', scheduledAt: '2026-09-01T10:00:00.000Z', employee: { nameAr: 'آخر سجل' } }], meta: { total: 51, page: 2, totalPages: 2 } }, isPending: false, isError: false };
    screen.rerender(<RecordsScreen />);
    fireEvent.press(screen.getByText('آخر سجل'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/b-50');
  });

  it('falls back to the account tab when opened with no history', () => {
    mockCanGoBack = false;
    const screen = render(<RecordsScreen />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/account');
  });
});
