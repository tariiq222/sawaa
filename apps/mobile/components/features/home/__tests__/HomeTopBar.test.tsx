import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'home.searchTherapists': 'Search therapists',
      'nav.notifications': 'Notifications',
      'nav.profile': 'Profile',
    })[key] ?? key,
  }),
}));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/sawaa', () => ({
  sawaaColors: { teal: { 700: '#123456' }, accent: { rose: '#654321' } },
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { HomeTopBar } from '../HomeTopBar';

describe('HomeTopBar', () => {
  beforeEach(() => mockPush.mockClear());

  it('opens the therapist directory from the search button', () => {
    const { getByRole } = render(<HomeTopBar f600="System" />);

    fireEvent.press(getByRole('button', { name: 'Search therapists' }));

    expect(mockPush).toHaveBeenCalledWith('/(client)/therapists');
    expect(getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(getByRole('button', { name: 'Profile' })).toBeTruthy();
  });
});
