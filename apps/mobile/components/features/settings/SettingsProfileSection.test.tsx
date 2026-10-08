import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { User } from '@/types/auth';
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
jest.mock('@/services/client', () => ({ clientProfileService: { updateProfile: (body: unknown) => mockUpdate(body) } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara New', email: 'sara@example.com', phone: '+966501234567' });
});

afterEach(() => jest.restoreAllMocks());

it('locks an assigned email with an explanation', () => {
  const screen = render(<SettingsProfileSection />);
  expect(screen.getByLabelText('settings.email').props.editable).toBe(false);
  expect(screen.getByText('settings.emailReadOnly')).toBeTruthy();
});

it('saves name and phone without submitting a changed assigned email', async () => {
  const screen = render(<SettingsProfileSection />);
  fireEvent.changeText(screen.getByLabelText('settings.email'), 'other@example.com');
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sara New', phone: '+966501234567' });
  expect(mockDispatch.mock.calls[0][0].payload.email).toBe('sara@example.com');
});

it('allows adding a missing email and stores the canonical response', async () => {
  mockUser = { ...baseUser, email: '' };
  mockUpdate.mockResolvedValue({ id: 'client-1', name: 'Sara', email: 'added@example.com', phone: '+966509876543' });
  const screen = render(<SettingsProfileSection />);
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
  const screen = render(<SettingsProfileSection />);
  fireEvent.changeText(screen.getByLabelText('settings.fullName'), 'Draft Name');
  await act(async () => { fireEvent.press(screen.getByText('settings.saveProfile')); });
  expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ name: '  Sara  New Family  ', firstName: 'Sara', lastName: 'New Family', phone: null });
  expect(screen.getByLabelText('settings.fullName').props.value).toBe('  Sara  New Family  ');
  expect(screen.getByLabelText('settings.phone').props.value).toBe('');
});

it('keeps save unavailable during the existing save request', async () => {
  let finish!: (value: typeof baseUser) => void;
  mockUpdate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<SettingsProfileSection />);
  fireEvent.changeText(view.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(view.getByText('settings.saveProfile')); });
  expect(view.getByRole('button', { name: 'settings.saveProfile' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await act(async () => finish(baseUser));
});
