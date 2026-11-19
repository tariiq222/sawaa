import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  Step,
  employee,
  fakeClient,
  service,
  slot,
  withLocale,
} from './client-info-step.test.fixtures';

const useCurrentClientMock = vi.fn();
const clientLoginApiMock = vi.fn();
const getMeApiMock = vi.fn();
const setClientMock = vi.fn();
let authGeneration = 0;
// Captured so individual tests can fire onSuccess() to exercise the
// inline-registration completion path without rendering the real 3-step form.
const registerFormProps: { onSuccess?: () => void } = {};

vi.mock('@/features/auth/use-current-client', () => ({
  CURRENT_CLIENT_QUERY_KEY: ['client', 'me'],
  useCurrentClient: () => useCurrentClientMock(),
}));
vi.mock('@/features/auth/auth.api', () => ({
  clientLoginApi: (...args: unknown[]) => clientLoginApiMock(...args),
  getMeApi: (...args: unknown[]) => getMeApiMock(...args),
}));
vi.mock('@/features/auth/auth-store', () => ({
  getAuthGeneration: () => authGeneration,
  setClient: (...args: unknown[]) => setClientMock(...args),
}));
vi.mock('@/features/auth/register-form', () => ({
  // Minimal stub — we don't care about the OTP/password sub-flow here,
  // only that the booking step embeds it, exposes a way to fire onSuccess,
  // and never renders an anchor to /register.
  RegisterForm: ({ onSuccess }: { onSuccess?: () => void }) => {
    registerFormProps.onSuccess = onSuccess;
    return (
      <div data-testid="register-form-stub">
        <span>InlineRegisterFormStub</span>
        <button type="button" onClick={() => onSuccess?.()}>
          complete-registration
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  authGeneration = 0;
  // Clear the captured onSuccess between tests so each new render gets a
  // fresh stub instance and there is no cross-test leakage of the previous
  // booking step's callback.
  registerFormProps.onSuccess = undefined;
});

describe('ClientInfoStep', () => {
  it('shows the loading placeholder when the session is still resolving', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Checking your account/i);
    expect(screen.getByPlaceholderText('05XXXXXXXX')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Checking your account/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), { target: { value: '0500000000' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret1' } });
    fireEvent.submit(screen.getByTestId('inline-signin'));
    expect(clientLoginApiMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: /Create an account/i }));
    expect(screen.queryByTestId('register-form-stub')).not.toBeInTheDocument();
  });

  it('shows the inline login form when the client is not signed in', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    // The login form inputs remain reachable via their placeholders.
    expect(screen.getByPlaceholderText('05XXXXXXXX')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('programmatically labels the phone and password inputs with matching htmlFor/id', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    const phone = screen.getByLabelText(/phone number/i);
    const password = screen.getByLabelText(/password/i);
    // Each input has a unique id matched by its label's htmlFor.
    expect(phone).toHaveAttribute('id');
    expect(password).toHaveAttribute('id');
    expect(phone.id).not.toBe(password.id);
    expect(screen.getByText('Phone number')).toHaveAttribute('for', phone.id);
    expect(screen.getByText('Password')).toHaveAttribute('for', password.id);
    // Existing input affordances are preserved.
    expect(phone).toHaveAttribute('autocomplete', 'tel');
    expect(phone).toHaveAttribute('inputmode', 'tel');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('requires a valid phone and password before calling the API', async () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(
      await screen.findByText(/valid Saudi phone number/i),
    ).toBeTruthy();
    expect(clientLoginApiMock).not.toHaveBeenCalled();
  });

  it('rejects a non-Saudi phone before calling the API', async () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), {
      target: { value: '12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Secret1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(
      await screen.findByText(/valid Saudi phone number/i),
    ).toBeTruthy();
    expect(clientLoginApiMock).not.toHaveBeenCalled();
  });

  it('loads the profile once after login and does not refetch it again', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch,
    });
    clientLoginApiMock.mockResolvedValueOnce(undefined);
    getMeApiMock.mockResolvedValueOnce(fakeClient);
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), {
      target: { value: '0500000000' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Secret1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(clientLoginApiMock).toHaveBeenCalledWith({
      phone: '+966500000000',
      password: 'Secret1',
    }));
    await waitFor(() => expect(getMeApiMock).toHaveBeenCalled());
    await waitFor(() => expect(setClientMock).toHaveBeenCalledWith(fakeClient));
    expect(getMeApiMock).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('accepts a successful login after an earlier guest auth check failed', async () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    clientLoginApiMock.mockResolvedValueOnce({ clientId: 'c1' });
    getMeApiMock.mockResolvedValueOnce(fakeClient);
    render(withLocale(<Step slot={slot} service={service} employee={employee} onSubmitInfo={vi.fn()} isSubmitting={false} />));
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), { target: { value: '0500000000' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(getMeApiMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(setClientMock).toHaveBeenCalledWith(fakeClient));
  });

  it('replaces an earlier unauthenticated query result with the verified profile', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['client', 'me'], null);
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    clientLoginApiMock.mockResolvedValueOnce({ clientId: 'c1' });
    getMeApiMock.mockResolvedValueOnce(fakeClient);
    render(withLocale(<Step slot={slot} service={service} employee={employee} onSubmitInfo={vi.fn()} isSubmitting={false} />, 'en', qc));
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), { target: { value: '0500000000' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(qc.getQueryData(['client', 'me'])).toEqual(fakeClient));
  });

  it('does not put an outdated profile back into the cache if logout races the login profile read', async () => {
    let finishProfile!: (value: typeof fakeClient) => void;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    clientLoginApiMock.mockResolvedValueOnce({ clientId: 'c1' });
    getMeApiMock.mockImplementationOnce(() => new Promise((resolve) => { finishProfile = resolve; }));
    render(withLocale(<Step slot={slot} service={service} employee={employee} onSubmitInfo={vi.fn()} isSubmitting={false} />, 'en', qc));
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), { target: { value: '0500000000' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(getMeApiMock).toHaveBeenCalledTimes(1));
    authGeneration += 1; // A logout happened before the pending /me response.
    finishProfile(fakeClient);
    await waitFor(() => expect(screen.getByRole('button', { name: /Sign in/i })).toBeEnabled());
    expect(setClientMock).not.toHaveBeenCalled();
    expect(qc.getQueryData(['client', 'me'])).toBeUndefined();
  });

  it('keeps profile loading errors visible and does not cache a missing profile', async () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    clientLoginApiMock.mockResolvedValueOnce({ clientId: 'c1' });
    getMeApiMock.mockRejectedValueOnce(new Error('Profile unavailable'));
    render(withLocale(<Step slot={slot} service={service} employee={employee} onSubmitInfo={vi.fn()} isSubmitting={false} />));
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), { target: { value: '0500000000' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByText('Profile unavailable')).toBeInTheDocument();
    expect(setClientMock).not.toHaveBeenCalled();
  });

  it('surfaces the error message from a failed login', async () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    clientLoginApiMock.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText('05XXXXXXXX'), {
      target: { value: '0500000000' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'badbad1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByText('Invalid credentials')).toBeTruthy();
  });
});
