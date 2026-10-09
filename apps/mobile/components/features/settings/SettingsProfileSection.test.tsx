import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { User } from '@/types/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsProfileSection } from './SettingsProfileSection';

const baseUser: User = {
  id: 'client-1', name: 'Sara Old', firstName: 'Sara', lastName: 'Old',
  email: 'sara@example.com', phone: '+966501234567', gender: null, avatarUrl: null,
  isActive: true, role: 'CLIENT', isSuperAdmin: false, permissions: [],
};
let mockUser = { ...baseUser };
const mockDispatch = jest.fn();
const mockUpdate = jest.fn();
const mockPush = jest.fn();
let mockEmailStatus: {
  data: { status: 'none' | 'unverified' | 'pending' | 'verified'; email: string | null; pendingEmail: string | null; prompt: boolean } | undefined;
} = { data: undefined };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: mockUser } }),
  useAppDispatch: () => mockDispatch,
}));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => 1, isSessionCurrent: () => true }));
jest.mock('@/services/client', () => ({ clientProfileService: { updateProfile: (body: unknown) => mockUpdate(body) } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' } }));
jest.mock('lucide-react-native', () => ({
  User: () => null, Mail: () => null, Phone: () => null, ChevronLeft: () => null, ChevronRight: () => null,
}));
jest.mock('@/hooks/queries', () => ({
  useClientEmailStatus: () => mockEmailStatus,
}));

let queryClient: QueryClient;
function Profile() { return <QueryClientProvider client={queryClient}><SettingsProfileSection /></QueryClientProvider>; }
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  mockEmailStatus = { data: undefined };
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara New', email: 'sara@example.com', phone: '+966501234567' });
});

afterEach(() => { queryClient.clear(); jest.restoreAllMocks(); });

it('offers no free-text phone or email editing; rows reflect the stored values', () => {
  mockEmailStatus = { data: { status: 'verified', email: 'sara@example.com', pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  expect(screen.queryByLabelText('settings.phone')).toBeNull();
  expect(screen.queryByLabelText('settings.email')).toBeNull();
  expect(screen.getByText('profile.phone.label')).toBeTruthy();
  expect(screen.getByText('+966501234567')).toBeTruthy();
  expect(screen.getByText('profile.email.label')).toBeTruthy();
  expect(screen.getByText('sara@example.com')).toBeTruthy();
});
it.each([
  ['pending', 'profile.email.confirmPending'],
  ['none', 'profile.email.add'],
] as const)('shows %s state copy on the email row', (status, copy) => {
  mockEmailStatus = { data: { status, email: null, pendingEmail: status === 'pending' ? 'p@example.test' : null, prompt: status === 'pending' } };
  const screen = render(<Profile />);
  expect(screen.getByText(copy)).toBeTruthy();
  expect(screen.queryByText('p@example.test')).toBeNull();
});
it('opens the manage email screen from the row', () => {
  mockEmailStatus = { data: { status: 'none', email: null, pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  fireEvent.press(screen.getByText('profile.email.label'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/email-verify', params: { mode: 'manage' } });
});
it('opens the phone verification screen from the row', () => {
  mockEmailStatus = { data: { status: 'none', email: null, pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  fireEvent.press(screen.getByText('profile.phone.label'));
  expect(mockPush).toHaveBeenCalledWith('/(client)/phone-verify');
});
it('saves the name without ever submitting email or phone fields', async () => {
  mockEmailStatus = { data: { status: 'verified', email: 'sara@example.com', pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sara New' });
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('phone');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('email');
});

it('allows adding a missing email through the row, not the form', () => {
  mockUser = { ...baseUser, email: '' };
  mockEmailStatus = { data: { status: 'none', email: null, pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  expect(screen.queryByLabelText('settings.email')).toBeNull();
  expect(screen.getByText('profile.email.add')).toBeTruthy();
});

it('uses the canonical multi-part name the server returns', async () => {
  mockUpdate.mockResolvedValue({ id: 'client-1', name: '  Sara  New Family  ', email: 'sara@example.com', phone: '+966501234567' });
  mockEmailStatus = { data: { status: 'verified', email: 'sara@example.com', pendingEmail: null, prompt: false } };
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Draft Name');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ name: '  Sara  New Family  ', firstName: 'Sara', lastName: 'New Family', phone: '+966501234567' });
  expect(screen.getByLabelText('settings.fullName').props.value).toBe('  Sara  New Family  ');
});

it('invalidates profile and portal reads after the server saves canonical values', async () => {
  mockEmailStatus = { data: { status: 'verified', email: 'sara@example.com', pendingEmail: null, prompt: false } };
  queryClient.setQueryData(['me', 1], baseUser);
  queryClient.setQueryData(['portal', 'home'], { client: { name: 'Sara Old' } });
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(queryClient.getQueryState(['me', 1])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['portal', 'home'])?.isInvalidated).toBe(true);
});

it('keeps save unavailable during the existing save request', async () => {
  let finish!: (value: typeof baseUser) => void;
  mockUpdate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mockEmailStatus = { data: { status: 'verified', email: 'sara@example.com', pendingEmail: null, prompt: false } };
  const view = render(<Profile />);
  fireEvent.changeText(view.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(view.getByText('settings.saveProfile')); });
  expect(view.getByRole('button', { name: 'settings.saveProfile' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await act(async () => { finish(baseUser); });
});
