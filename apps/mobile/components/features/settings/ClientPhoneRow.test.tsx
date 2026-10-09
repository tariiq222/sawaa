import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { User } from '@/types/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientPhoneRow } from './ClientPhoneRow';

const baseUser: User = {
  id: 'client-1', name: 'Sara', firstName: 'Sara', lastName: '',
  email: 'sara@example.com', phone: '+966501234567', gender: null, avatarUrl: null,
  isActive: true, role: 'CLIENT', isSuperAdmin: false, permissions: [],
};
let mockUser: User = { ...baseUser };
const mockPush = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (state: { auth: { user: User | null } }) => unknown) => select({ auth: { user: mockUser } }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('lucide-react-native', () => ({
  Phone: () => null, ChevronLeft: () => null, ChevronRight: () => null,
}));

let queryClient: QueryClient;
function Row() { return <QueryClientProvider client={queryClient}><ClientPhoneRow /></QueryClientProvider>; }
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  jest.clearAllMocks();
  mockUser = { ...baseUser };
});
afterEach(() => { queryClient.clear(); });

it('shows the current phone number left-to-right and navigates to verification', () => {
  const screen = render(<Row />);
  expect(screen.getByText('+966501234567')).toBeTruthy();
  expect(screen.getByText('profile.phone.label')).toBeTruthy();
  fireEvent.press(screen.getByText('profile.phone.label'));
  expect(mockPush).toHaveBeenCalledWith('/(client)/phone-verify');
});
it('renders an empty value while the stored phone is missing', () => {
  mockUser = { ...baseUser, phone: null };
  const screen = render(<Row />);
  expect(screen.queryByText('+966501234567')).toBeNull();
  fireEvent.press(screen.getByText('profile.phone.label'));
  expect(mockPush).toHaveBeenCalledWith('/(client)/phone-verify');
});
