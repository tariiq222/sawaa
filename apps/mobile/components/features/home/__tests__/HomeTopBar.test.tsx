import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: { auth: { user: null } }) => unknown) =>
    selector({ auth: { user: null } }),
}));
jest.mock('@/hooks/useUnreadCount', () => ({ useUnreadCount: () => ({ count: 0 }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'en', isRTL: false }),
}));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ scheme: 'light' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Deliberately NOT mocking react-i18next: these labels must come from the real
// locale files, so a key that exists only in a test double fails here instead of
// silently shipping as a raw "some.key" accessibility label.
import i18n from '@/i18n';
import { HomeTopBar } from '../HomeTopBar';

describe('HomeTopBar', () => {
  beforeEach(() => mockPush.mockClear());

  it.each([
    ['en', 'Search therapists', 'Notifications', 'Profile'],
    ['ar', 'البحث عن معالجين', 'الإشعارات', 'الملف الشخصي'],
  ])('labels its buttons from the real %s locale', async (language, search, notifications, profile) => {
    await act(async () => { await i18n.changeLanguage(language as string); });
    const { getByRole } = render(<HomeTopBar f600="System" />);

    fireEvent.press(getByRole('button', { name: search as string }));

    expect(mockPush).toHaveBeenCalledWith('/(client)/therapists');
    expect(getByRole('button', { name: notifications as string })).toBeTruthy();
    expect(getByRole('button', { name: profile as string })).toBeTruthy();
  });

  it('keeps only discovery controls for guests', async () => {
    await act(async () => { await i18n.changeLanguage('ar'); });
    const { getByRole, getByText, queryByRole } = render(<HomeTopBar f600="System" isClient={false} />);
    expect(getByRole('button', { name: 'البحث عن معالجين' })).toBeTruthy();
    expect(getByText('مركز سواء للإرشاد الأسري')).toBeTruthy();
    expect(queryByRole('button', { name: 'تسجيل الدخول' })).toBeNull();
  });
});
