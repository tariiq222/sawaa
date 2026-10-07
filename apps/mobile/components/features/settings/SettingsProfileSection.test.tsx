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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: mockUser } }),
  useAppDispatch: () => mockDispatch,
}));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => 1, isSessionCurrent: () => true }));
jest.mock('@/services/client', () => ({ clientProfileService: { updateProfile: (body: unknown) => mockUpdate(body) } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' } }));

let queryClient: QueryClient;
function Profile() { return <QueryClientProvider client={queryClient}><SettingsProfileSection /></QueryClientProvider>; }
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara New', email: 'sara@example.com', phone: '+966501234567' });
});

afterEach(() => { queryClient.clear(); jest.restoreAllMocks(); });

it('locks an assigned email with an explanation', () => {
  const screen = render(<Profile />);
  expect(screen.getByLabelText('settings.email').props.editable).toBe(false);
  expect(screen.getByText('settings.emailReadOnly')).toBeTruthy();
});

it('saves name and phone without submitting a changed assigned email', async () => {
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.email'), 'other@example.com');
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sara New', phone: '+966501234567' });
  expect(mockDispatch.mock.calls[0][0].payload.email).toBe('sara@example.com');
});

it('allows adding a missing email and stores the canonical response', async () => {
  mockUser = { ...baseUser, email: '' };
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara', email: 'added@example.com', phone: '+966509876543' });
  const screen = render(<Profile />);
  expect(screen.getByLabelText('settings.email').props.editable).toBe(true);
  fireEvent.changeText(screen.getByLabelText('settings.email'), 'added@example.com');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sara Old', phone: '+966501234567', email: 'added@example.com' });
  expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ name: 'Sara', firstName: 'Sara', lastName: '', email: 'added@example.com', phone: '+966509876543' });
  expect(screen.getByLabelText('settings.email').props.value).toBe('added@example.com');
  expect(screen.getByLabelText('settings.fullName').props.value).toBe('Sara');
  expect(screen.getByLabelText('settings.phone').props.value).toBe('+966509876543');
  expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ role: 'CLIENT', permissions: [], isActive: true, gender: null, avatarUrl: null });
});

it('uses the canonical multi-part name and cleared phone without retaining stale fields', async () => {
  mockUpdate.mockResolvedValue({ id: 'client-1', name: '  Sara  New Family  ', email: 'sara@example.com', phone: null });
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Draft Name');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ name: '  Sara  New Family  ', firstName: 'Sara', lastName: 'New Family', phone: null });
  expect(screen.getByLabelText('settings.fullName').props.value).toBe('  Sara  New Family  ');
  expect(screen.getByLabelText('settings.phone').props.value).toBe('');
});

it('invalidates profile and portal reads after the server saves canonical values', async () => {
  queryClient.setQueryData(['me', 1], baseUser);
  queryClient.setQueryData(['portal', 'home'], { client: { name: 'Sara Old' } });
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(queryClient.getQueryState(['me', 1])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['portal', 'home'])?.isInvalidated).toBe(true);
});

it('accepts a trimmed international phone and submits it for backend normalization', async () => {
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara Old', email: 'sara@example.com', phone: '+14155550100' });
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.phone'), '  +1 (415) 555-0100  ');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sara Old', phone: '+1 (415) 555-0100' });
  expect(screen.getByLabelText('settings.phone').props.value).toBe('+14155550100');
});

it('rejects malformed phone without invoking the update mutation', async () => {
  const screen = render(<Profile />);
  fireEvent.changeText(screen.getByLabelText('settings.phone'), '+9665123');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.getByText('settings.errors.invalidPhone')).toBeTruthy();
});
