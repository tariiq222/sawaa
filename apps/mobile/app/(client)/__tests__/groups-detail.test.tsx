import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockToken: string | null = 'token';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

const mockMutate = jest.fn();
const mockGroup = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockBranding = { data: { contactPhone: '0500000000' } as { contactPhone: string | null } };
jest.mock('@/hooks/queries', () => ({
  useGroupSession: () => mockGroup,
  useBookGroupSession: () => ({ mutate: mockMutate, isPending: false }),
  useBranding: () => mockBranding,
}));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockToken } }),
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
jest.mock('lucide-react-native', () => ({
  ChevronLeft: () => null, ChevronRight: () => null, CalendarDays: () => null,
  Clock: () => null, Users: () => null, Wallet: () => null, CalendarRange: () => null,
}));

import i18n from '@/i18n';
import { DirContext, buildDirState } from '@/hooks/useDir';
import GroupDetailScreen from '../groups/[id]';

const base = {
  id: 'g1', nameAr: 'مجموعة', nameEn: 'Group', scheduledAt: '2026-10-20T10:00:00Z', durationMins: 60,
  enrolledCount: 5, maxCapacity: 10, maxParticipants: 10, price: '0', isFull: false, spotsLeft: 5,
  daysCount: 0, hoursPerDay: 0,
};

async function renderAr() {
  await i18n.changeLanguage('ar');
  return render(<DirContext.Provider value={buildDirState('ar')}><GroupDetailScreen /></DirContext.Provider>);
}

describe('group detail screen', () => {
  beforeEach(() => {
    mockMutate.mockReset(); mockReplace.mockReset(); mockPush.mockReset(); mockToken = 'token';
    mockGroup.data = base; mockGroup.isError = false;
    mockBranding.data = { contactPhone: '0500000000' };
  });

  it('shows a load error, not the join error, when loading fails', async () => {
    mockGroup.data = undefined; mockGroup.isError = true;
    const view = await renderAr();
    expect(view.getByText('تعذّر تحميل مجموعات الدعم')).toBeTruthy();
    expect(view.queryByText('تعذر إتمام الانضمام، حاول مرة أخرى')).toBeNull();
  });

  it('replaces the register button with the contact hint and a dial action when full', async () => {
    mockGroup.data = { ...base, isFull: true, spotsLeft: 0 };
    const dial = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const view = await renderAr();
    expect(view.queryByText('سجّل في المجموعة')).toBeNull();
    expect(view.getByText('المجموعة مكتملة — تواصل معنا لمعرفة المواعيد القادمة')).toBeTruthy();
    fireEvent.press(view.getByText('تواصل معنا'));
    expect(dial).toHaveBeenCalledWith('tel:0500000000');
    dial.mockRestore();
  });

  it('hides the dial action when no center phone is configured', async () => {
    mockGroup.data = { ...base, isFull: true, spotsLeft: 0 };
    mockBranding.data = { contactPhone: null };
    const view = await renderAr();
    expect(view.queryByText('تواصل معنا')).toBeNull();
  });

  it('continues to the client confirm step without enrolling', async () => {
    const view = await renderAr();
    expect(view.queryByText('سجّل في المجموعة')).toBeNull();
    fireEvent.press(view.getByText('متابعة'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/groups/confirm', params: { id: 'g1' } });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('continues a guest to the public confirm step', async () => {
    mockToken = null;
    const view = await renderAr();
    fireEvent.press(view.getByText('متابعة'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-groups/confirm', params: { id: 'g1' } });
  });
});
