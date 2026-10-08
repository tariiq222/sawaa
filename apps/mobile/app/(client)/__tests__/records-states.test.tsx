import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
import { act, fireEvent, render } from '@testing-library/react-native';

let mockReduceMotion = false;
const mockEntering: unknown[] = [];
const mockDelay = jest.fn();
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduceMotion }));
jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: (delay: number) => { mockDelay(delay); return animation; }, easing: () => animation };
  return { __esModule: true, default: { View: ({ entering, ...props }: { entering?: unknown }) => { mockEntering.push(entering); return require('react').createElement(require('react-native').View, props); } }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));
// Native icon font hydration is outside these navigation/state checks.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

const mockRefetch = jest.fn();
let mockQuery: { data?: { items: unknown[] }; isPending: boolean; isError: boolean };
const mockUseClientBookings = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useClientBookings: (params: unknown) => {
    mockUseClientBookings(params);
    return { ...mockQuery, refetch: mockRefetch };
  },
}));

import RecordsScreen from '../records';

beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true; mockReduceMotion = false; mockEntering.length = 0;
    mockQuery = { data: undefined, isPending: false, isError: false };
});

describe('records screen states', () => {
  it('requests completed appointments through the shared bookings query', () => {
    render(<RecordsScreen />);
    expect(mockUseClientBookings).toHaveBeenCalledWith({ status: 'completed', limit: 50 });
  });

  it('shows neither the empty state nor the error while loading', () => {
    mockQuery = { isPending: true, isError: false };
    const screen = render(<RecordsScreen />);
    expect(screen.queryByText('records.empty')).toBeNull();
    expect(screen.queryByText('records.loadError')).toBeNull();
  });

  it('shows a retryable error instead of the empty state when loading fails', async () => {
    mockQuery = { isPending: false, isError: true };
    const screen = render(<RecordsScreen />);
    expect(screen.getByText('records.loadError')).toBeTruthy();
    expect(screen.queryByText('records.empty')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('common.retry')); });
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

  it('falls back to the account tab when opened with no history', () => {
    mockCanGoBack = false;
    const screen = render(<RecordsScreen />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/account');
  });
});

const record = { id: 'b-1', scheduledAt: '2026-09-01T10:00:00.000Z', deliveryType: 'IN_PERSON', employee: { nameAr: 'سارة اسم طويل', nameEn: 'Sara Long Name' }, service: { nameAr: 'إرشاد أسري طويل', nameEn: 'Long Family Counseling' } };
it('exposes record details as a complete navigation action', () => {
 mockQuery = { data: { items: [record] }, isPending: false, isError: false };
 const view = render(<RecordsScreen />);
 fireEvent.press(view.getByRole('button', { name: /سارة اسم طويل.*إرشاد أسري طويل/ }));
 expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/b-1');
});
it.each([true, false])('keeps 50 response-ordered records reachable with Reduce Motion %s', reduced => {
 mockEntering.length = 0; mockDelay.mockClear(); mockReduceMotion = reduced;
 mockQuery = { data: { items: Array.from({ length: 50 }, (_, i) => ({ ...record, id: `b-${i}`, employee: { nameAr: `مختص ${i}` } })) }, isPending: false, isError: false };
 const view = render(<RecordsScreen />);
 const rows = view.getAllByRole('button', { name: /مختص/ });
 expect(rows).toHaveLength(50);
 rows.forEach((row, i) => expect(row.props.accessibilityLabel).toContain(`مختص ${i}.`));
 if (reduced) expect(mockEntering.every(value => value === undefined)).toBe(true);
 else expect(Math.max(...mockDelay.mock.calls.map(([delay]) => delay))).toBeLessThanOrEqual(240);
});
