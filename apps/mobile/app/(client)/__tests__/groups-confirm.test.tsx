import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { decodeRedirect } from '@/lib/navigation';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockMutate = jest.fn();
let mockToken: string | null = null;
let mockGroup: Record<string, unknown> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'g1' }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockToken } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: require('react-native').View,
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/hooks/queries', () => ({
  useGroupSession: () => ({ data: mockGroup, isLoading: false, isError: false, refetch: jest.fn() }),
  useBookGroupSession: () => ({ mutate: mockMutate, isPending: false }),
}));

import GroupConfirmScreen from '../groups/confirm';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = null;
  mockGroup = {
    id: 'g1', nameAr: 'مجموعة', nameEn: 'Group One', scheduledAt: null, startDate: null, price: 10000,
    daysCount: 3, hoursPerDay: 0, isFull: false, depositEnabled: false, depositAmount: null,
  };
});

it('summarises the group and shows a date-to-be-announced row', () => {
  const screen = render(<GroupConfirmScreen />);
  expect(screen.getByText('Group One')).toBeTruthy();
  expect(screen.getByText('groups.dateTba')).toBeTruthy();
  expect(screen.getByText('groups.daysLabel')).toBeTruthy();
  expect(screen.queryByText('groups.hoursPerDayLabel')).toBeNull();
});

it('sends a guest to login and back to this confirm step', () => {
  const screen = render(<GroupConfirmScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'booking.signInOrRegisterToContinue' }));
  const href = mockPush.mock.calls[0][0];
  expect(href.pathname).toBe('/(auth)/login');
  expect(decodeRedirect(href.params.redirect)).toEqual({ pathname: '/(client)/groups/confirm', params: { id: 'g1' } });
  expect(mockMutate).not.toHaveBeenCalled();
});

it('enrols a signed-in client and opens checkout for the invoice', () => {
  mockToken = 'token';
  mockMutate.mockImplementation((_id: string, options: { onSuccess: (enrollment: unknown) => void }) => {
    options.onSuccess({ bookingId: 'b1', invoiceId: 'i1', status: 'PENDING_PAYMENT' });
  });
  const screen = render(<GroupConfirmScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'groups.registerInSession' }));
  expect(mockMutate).toHaveBeenCalledWith('g1', expect.any(Object));
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/(client)/booking/checkout',
    params: { bookingId: 'b1', invoiceId: 'i1', programId: 'g1' },
  });
});

it('goes to appointments after a confirmed enrolment', () => {
  mockToken = 'token';
  mockMutate.mockImplementation((_id: string, options: { onSuccess: (enrollment: unknown) => void }) => {
    options.onSuccess({ bookingId: 'b1', invoiceId: null, status: 'CONFIRMED' });
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.[0]?.onPress?.(); });
  const screen = render(<GroupConfirmScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'groups.registerInSession' }));
  expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
  alert.mockRestore();
});
