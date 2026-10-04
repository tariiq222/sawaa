import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ bookingId: 'booking-9' }),
}));

const mockMutate = jest.fn();
const mockBooking = {
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};
jest.mock('@/hooks/queries', () => ({
  useBooking: () => mockBooking,
  useRateBooking: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => true,
  useReducedTransparency: () => false,
  useIncreasedContrast: () => false,
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['delay', 'duration', 'easing']) builder[method] = () => builder;
    return builder;
  };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: chain(),
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Star: () => null,
  User: () => null,
}));

import i18n from '@/i18n';
import { DirContext, buildDirState } from '@/hooks/useDir';
import RateScreen from '../rate/[bookingId]';

const booking = {
  id: 'booking-9',
  employee: { id: 'e1', nameAr: 'د. نورة القحطاني', nameEn: 'Dr. Noura Al-Qahtani', avatarUrl: null },
  employeeName: 'Dr. Noura Al-Qahtani',
  employeeNameAr: 'د. نورة القحطاني',
  serviceName: 'جلسة فردية',
  serviceNameAr: 'جلسة فردية',
  scheduledAt: '2026-09-20T13:00:00+03:00',
  durationMins: 45,
  status: 'completed',
};

async function renderIn(language: 'ar' | 'en') {
  await act(async () => {
    await i18n.changeLanguage(language);
  });
  return render(
    <DirContext.Provider value={buildDirState(language)}>
      <RateScreen />
    </DirContext.Provider>,
  );
}

describe('rate screen shows the booking being rated, not a placeholder therapist', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockBack.mockReset();
    mockBooking.data = booking;
    mockBooking.isLoading = false;
    mockBooking.isError = false;
    mockBooking.refetch = jest.fn();
  });

  it('renders the therapist and time of the rated booking in Arabic', async () => {
    const view = await renderIn('ar');
    expect(view.getByText('د. نورة القحطاني')).toBeTruthy();
    expect(view.queryByText('د. فاطمة العمران')).toBeNull();
    expect(view.queryByText("Today's session · 4:00 PM")).toBeNull();
  });

  it('renders the therapist of the rated booking in English', async () => {
    const view = await renderIn('en');
    expect(view.getByText('Dr. Noura Al-Qahtani')).toBeTruthy();
    expect(view.queryByText('Dr. Fatima Al-Omran')).toBeNull();
  });

  it('falls back to the generic therapist label when the booking has no employee name', async () => {
    mockBooking.data = { ...booking, employee: null, employeeName: undefined, employeeNameAr: null };
    const view = await renderIn('ar');
    expect(view.getByText(i18n.getFixedT('ar')('therapists.unknownName'))).toBeTruthy();
  });

  it('shows a retryable error instead of a made-up therapist when the booking fails to load', async () => {
    mockBooking.data = undefined;
    mockBooking.isError = true;
    const view = await renderIn('ar');
    const t = i18n.getFixedT('ar');

    expect(view.getByText(t('common.error'))).toBeTruthy();
    const retry = view.getByText(t('common.retry'));
    fireEvent.press(retry);
    expect(mockBooking.refetch).toHaveBeenCalledTimes(1);
    expect(view.queryByText('د. فاطمة العمران')).toBeNull();
  });

  it('submits the rating against the rated booking id', async () => {
    mockMutate.mockImplementation((_vars: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });
    const view = await renderIn('ar');

    // Each star carries its own accessible label (a11y.rateStars).
    fireEvent.press(view.getByLabelText('تقييم 5 نجوم'));
    fireEvent.press(view.getByText('إرسال التقييم'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-9', score: 5, isPublic: true }),
      expect.anything(),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('surfaces a submission failure to the user', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockMutate.mockImplementation((_vars: unknown, options: { onError?: (error: Error) => void }) => {
      options.onError?.(new Error('server rejected'));
    });
    const view = await renderIn('ar');

    fireEvent.press(view.getByLabelText('تقييم 5 نجوم'));
    fireEvent.press(view.getByText('إرسال التقييم'));

    expect(alertSpy).toHaveBeenCalledWith('تعذّر إرسال التقييم', 'server rejected');
    alertSpy.mockRestore();
  });

  it('keeps submission disabled while the booking is still loading', async () => {
    mockBooking.data = undefined;
    mockBooking.isLoading = true;
    const view = await renderIn('ar');

    expect(view.getByRole('button', { name: 'إرسال التقييم' })).toBeDisabled();

    fireEvent.press(view.getByLabelText('تقييم 5 نجوم'));
    fireEvent.press(view.getByText('إرسال التقييم'));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('keeps submission disabled after the booking failed to load, and stays retryable', async () => {
    mockBooking.data = undefined;
    mockBooking.isLoading = false;
    mockBooking.isError = true;
    const view = await renderIn('ar');

    expect(view.getByRole('button', { name: 'إرسال التقييم' })).toBeDisabled();

    fireEvent.press(view.getByLabelText('تقييم 5 نجوم'));
    fireEvent.press(view.getByText('إرسال التقييم'));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(view.getByText(i18n.getFixedT('ar')('common.retry'))).toBeTruthy();
  });
});
