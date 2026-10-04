import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => mockDispatch }));

jest.mock('@/stores/slices/auth-slice', () => ({
  setCredentials: (payload: unknown) => ({ type: 'auth/setCredentials', payload }),
  setLoading: (payload: unknown) => ({ type: 'auth/setLoading', payload }),
}));

const mockRegister = jest.fn();
jest.mock('@/services/auth', () => ({
  authService: { register: (...args: unknown[]) => mockRegister(...args) },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import i18n from '@/i18n';
import { useRegisterForm } from '../use-register-form';

const t = (key: string) => i18n.getFixedT('en')(`auth.${key}`);

async function renderForm() {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
  return renderHook(() => useRegisterForm());
}

async function fill(
  result: { current: ReturnType<typeof useRegisterForm> },
  values: Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword', string>>,
) {
  await act(async () => {
    if (values.firstName !== undefined) result.current.setters.setFirstName(values.firstName);
    if (values.lastName !== undefined) result.current.setters.setLastName(values.lastName);
    if (values.email !== undefined) result.current.setters.setEmail(values.email);
    if (values.password !== undefined) result.current.setters.setPassword(values.password);
    if (values.confirmPassword !== undefined) result.current.setters.setConfirmPassword(values.confirmPassword);
  });
}

const validValues = {
  firstName: 'Nora',
  lastName: 'Alqahtani',
  email: 'nora@example.com',
  password: 'strongpass1',
  confirmPassword: 'strongpass1',
};

describe('useRegisterForm', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockDispatch.mockReset();
    mockReplace.mockReset();
  });

  it('blocks registration and reports every invalid field', async () => {
    const { result } = await renderForm();
    await fill(result, { email: 'not-an-email', password: 'short', confirmPassword: 'other' });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(result.current.errors.firstName).toBe(t('firstNameRequired'));
    expect(result.current.errors.lastName).toBe(t('lastNameRequired'));
    expect(result.current.errors.email).toBe(t('invalidEmail'));
    expect(result.current.errors.password).toBe(t('passwordMinLength'));
    expect(result.current.errors.confirmPassword).toBe(t('passwordMismatch'));
  });

  it('requires a password before checking its length', async () => {
    const { result } = await renderForm();
    await fill(result, { ...validValues, password: '', confirmPassword: '' });

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(result.current.errors.password).toBe(t('passwordRequired'));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('clears a field error once the user edits that field', async () => {
    const { result } = await renderForm();
    await fill(result, { email: 'bad' });

    await act(async () => {
      await result.current.handleRegister();
    });
    expect(result.current.errors.email).toBe(t('invalidEmail'));

    await act(async () => {
      result.current.clearError('email');
    });
    expect(result.current.errors.email).toBeUndefined();
  });

  it('stores the session and navigates home on success', async () => {
    mockRegister.mockResolvedValue({
      success: true,
      data: {
        accessToken: 'a-1',
        refreshToken: 'r-1',
        user: { id: 'u-1', role: 'CLIENT' },
      },
    });
    const { result } = await renderForm();
    await fill(result, validValues);

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'Nora',
      lastName: 'Alqahtani',
      email: 'nora@example.com',
      password: 'strongpass1',
      phone: undefined,
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'auth/setCredentials',
      payload: {
        accessToken: 'a-1',
        refreshToken: 'r-1',
        user: { id: 'u-1', role: 'CLIENT' },
      },
    });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/setLoading', payload: false });
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    expect(result.current.loading).toBe(false);
  });

  it('reports a failed registration without navigating', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRegister.mockRejectedValue(new Error('email already used'));
    const { result } = await renderForm();
    await fill(result, validValues);

    await act(async () => {
      await result.current.handleRegister();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      i18n.getFixedT('en')('common.error'),
      t('registerError'),
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    alertSpy.mockRestore();
  });
});
