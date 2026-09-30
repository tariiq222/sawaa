import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end', writingDirection: 'rtl' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.error': 'حدث خطأ',
        'common.errorDescription': 'تعذّر تحميل البيانات. حاول مرة أخرى.',
        'common.tryAgain': 'حاول مرة أخرى',
        'common.retry': 'إعادة المحاولة',
        'common.offlineTitle': 'لا يوجد اتصال بالإنترنت',
        'common.offlineDescription': 'تحقق من الاتصال ثم حاول مرة أخرى.',
        'common.noResults': 'لا توجد نتائج',
        'common.noResultsDescription': 'جرّب كلمات أخرى أو غيّر التصفية.',
        'common.clearSearch': 'مسح البحث',
        'common.loading': 'جاري التحميل',
      })[key] ?? key,
  }),
}));

let mockReduceMotion = false;
const mockWithRepeat = jest.fn((value: number) => value);
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduceMotion }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (factory: () => unknown) => factory(),
  withTiming: (value: number) => value,
  withRepeat: (value: number) => mockWithRepeat(value),
  Easing: { out: () => undefined, cubic: undefined },
}));

import { ErrorState } from '../ErrorState';
import { ListSkeleton } from '../ListSkeleton';
import { NoResultsState } from '../NoResultsState';
import { OfflineState } from '../OfflineState';

describe('state components', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    mockWithRepeat.mockClear();
  });

  it('ErrorState shows the default copy and fires the retry action', () => {
    const onRetry = jest.fn();
    const screen = render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByText('حدث خطأ')).toBeTruthy();
    expect(screen.getByText('تعذّر تحميل البيانات. حاول مرة أخرى.')).toBeTruthy();
    fireEvent.press(screen.getByText('حاول مرة أخرى'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState accepts custom copy and hides the button without a handler', () => {
    const screen = render(<ErrorState title="تعذّر التحميل" description="وصف" />);
    expect(screen.getByText('تعذّر التحميل')).toBeTruthy();
    expect(screen.getByText('وصف')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('OfflineState shows the offline copy and a retry button', () => {
    const onRetry = jest.fn();
    const screen = render(<OfflineState onRetry={onRetry} />);
    expect(screen.getByText('لا يوجد اتصال بالإنترنت')).toBeTruthy();
    expect(screen.getByText('تحقق من الاتصال ثم حاول مرة أخرى.')).toBeTruthy();
    fireEvent.press(screen.getByText('إعادة المحاولة'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('NoResultsState shows the hint and an outlined clear button', () => {
    const onClear = jest.fn();
    const screen = render(<NoResultsState onClear={onClear} />);
    expect(screen.getByText('لا توجد نتائج')).toBeTruthy();
    expect(screen.getByText('جرّب كلمات أخرى أو غيّر التصفية.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'مسح البحث' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('NoResultsState has no button without a clear handler', () => {
    const screen = render(<NoResultsState />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ListSkeleton renders the requested number of cards with a loading label', () => {
    const screen = render(<ListSkeleton count={3} />);
    expect(screen.getAllByTestId('list-skeleton-card')).toHaveLength(3);
    expect(screen.getByLabelText('جاري التحميل')).toBeTruthy();
  });

  it('ListSkeleton pulses normally and stays still with reduce-motion on', () => {
    render(<ListSkeleton count={1} />);
    expect(mockWithRepeat).toHaveBeenCalled();
    mockWithRepeat.mockClear();
    mockReduceMotion = true;
    render(<ListSkeleton count={1} />);
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });
});
