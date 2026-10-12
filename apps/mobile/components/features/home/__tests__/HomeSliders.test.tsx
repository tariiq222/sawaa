import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockSignedIn = false;
const family = {
  id: 'family-1', nameAr: 'باقة الأسرة', nameEn: 'Family package', descriptionAr: null, descriptionEn: null, vatRate: 0,
  options: [
    { id: 'o1', sessionCount: 4, price: { finalPrice: 40000 }, displayGroups: [] },
    { id: 'o2', sessionCount: 8, price: { finalPrice: 70000 }, displayGroups: [] },
  ],
};
const program = { id: 'program-1', nameAr: 'مجموعة الدعم', nameEn: 'Support group', scheduledAt: null, price: '30000', currency: 'SAR', isFull: false, spotsLeft: 3 };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/queries', () => ({ usePackageFamilies: () => ({ data: [family] }), useGroupSessions: () => ({ data: [program] }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'jwt' : null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, row: 'row', textAlign: 'left', locale: 'en' }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/components/ui/LocalizedHorizontalScroll', () => ({ LocalizedHorizontalScroll: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/DateBox', () => ({ DateBox: () => null }));
jest.mock('@/components/ui/Thumb', () => ({ Thumb: () => null }));
jest.mock('@/components/ui/Pill', () => ({ Pill: ({ label }: { label: string }) => { const { Text } = require('react-native'); return <Text>{label}</Text>; } }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
} }));

import { HomePackagesSlider } from '../HomePackagesSlider';
import { HomeGroupsSlider } from '../HomeGroupsSlider';

const dir = { isRTL: false, row: 'row', textAlign: 'left', locale: 'en' } as never;

beforeEach(() => { mockPush.mockClear(); mockSignedIn = false; });

describe('home sliders', () => {
  it('opens a package publicly for guests and in the client area when signed in', () => {
    const guest = render(<HomePackagesSlider dir={dir} f400="System" f700="System" />);
    expect(guest.getByText('packages.startsFrom')).toBeTruthy();
    expect(guest.getByText('packages.sessionsFrom')).toBeTruthy();
    fireEvent.press(guest.getByRole('button', { name: 'Family package' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'package', id: 'family-1' } });

    mockSignedIn = true;
    const client = render(<HomePackagesSlider dir={dir} f400="System" f700="System" />);
    fireEvent.press(client.getByRole('button', { name: 'Family package' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(client)/packages/[id]', params: { id: 'family-1' } });
  });

  it('opens a support group publicly for guests and in the client area when signed in', () => {
    const guest = render(<HomeGroupsSlider dir={dir} f400="System" f700="System" />);
    expect(guest.getByText('groups.spotsLeft')).toBeTruthy();
    expect(guest.getByText('groups.dateTba')).toBeTruthy();
    fireEvent.press(guest.getByRole('button', { name: 'Support group' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'program', id: 'program-1' } });

    mockSignedIn = true;
    const client = render(<HomeGroupsSlider dir={dir} f400="System" f700="System" />);
    fireEvent.press(client.getByRole('button', { name: 'Support group' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(client)/groups/[id]', params: { id: 'program-1' } });
  });
});
