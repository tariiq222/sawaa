import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  Step,
  employee,
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
  // === Inline registration mode toggle ===
  // The booking step must never navigate to /register or /login — both
  // would unmount the wizard and drop the chosen service/therapist/slot.
  // Instead it offers a tablist that swaps between the existing inline
  // sign-in form and the embedded RegisterForm.

  it('default mode renders the sign-in form (phone + password) and no register form yet', () => {
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
    // Inline sign-in is the default.
    expect(screen.getByPlaceholderText('05XXXXXXXX')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.queryByTestId('register-form-stub')).toBeNull();
    // The tablist exposes both options with aria-selected.
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking "Create an account" swaps to the register form without navigation', () => {
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
    // No <a href="/register"> or <a href="/login"> anchors anywhere in the
    // unauthenticated booking step.
    expect(screen.queryByRole('link', { name: /Create an account/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Go to sign-in page/i })).toBeNull();

    // Click the "Create an account" tab (the second tab in the tablist).
    const createTab = screen.getByRole('tab', { name: /Create an account/i });
    fireEvent.click(createTab);

    // The register form stub is now mounted.
    expect(screen.getByTestId('register-form-stub')).toBeTruthy();
    // Tab selection flipped.
    expect(createTab).toHaveAttribute('aria-selected', 'true');
    const signInTab = screen.getByRole('tab', { name: /Sign in/i });
    expect(signInTab).toHaveAttribute('aria-selected', 'false');
    // And still no /register anchor in the rendered tree.
    const html = document.body.innerHTML;
    expect(html).not.toContain('href="/register"');
    expect(html).not.toContain('href="/login"');
  });

  it('the unauthenticated state never renders any <a href="/login"> or <a href="/register"> anchor', () => {
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
    // The only navigation away from /booking that should survive in the
    // unauthenticated branch is the forgot-password link, which opens in a
    // new tab so the wizard itself is preserved.
    const loginAnchors = Array.from(document.querySelectorAll('a')).filter(
      (a) => a.getAttribute('href') === '/login',
    );
    const registerAnchors = Array.from(document.querySelectorAll('a')).filter(
      (a) => a.getAttribute('href') === '/register',
    );
    expect(loginAnchors).toHaveLength(0);
    expect(registerAnchors).toHaveLength(0);
    // Forgot password is the one allowed link and it must open in a new tab.
    const forgot = document.querySelector('a[href="/forgot-password"]');
    expect(forgot).not.toBeNull();
    expect(forgot).toHaveAttribute('target', '_blank');
    expect(forgot).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('switching back to "Sign in" restores the phone + password fields', () => {
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
    // Move to register.
    fireEvent.click(screen.getByRole('tab', { name: /Create an account/i }));
    expect(screen.getByTestId('register-form-stub')).toBeTruthy();
    expect(screen.queryByPlaceholderText('05XXXXXXXX')).toBeNull();
    expect(screen.queryByPlaceholderText('••••••••')).toBeNull();

    // Switch back to sign-in.
    fireEvent.click(screen.getByRole('tab', { name: /Sign in/i }));

    // Sign-in inputs are back, register stub is gone.
    expect(screen.getByPlaceholderText('05XXXXXXXX')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.queryByTestId('register-form-stub')).toBeNull();
  });

  it('calls refetch() when the embedded RegisterForm completes — no navigation', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch,
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
    // Flip to register mode.
    fireEvent.click(screen.getByRole('tab', { name: /Create an account/i }));
    expect(registerFormProps.onSuccess).toBeTypeOf('function');

    // Simulate the RegisterForm completing its 3-step flow.
    registerFormProps.onSuccess?.();

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    // The handler MUST NOT touch the router or window — that's the whole
    // point of the inline flow.
    expect(window.location.href).toBe('http://localhost:3000/');
  });

  // === Guest sub-heading copy regression ===
  // The trailing privacy sentence ("بياناتك سرّية ولا تُستخدم خارج المركز"
  // / "Your data is private and never leaves the centre.") was removed from
  // the unauthenticated sub-heading. The remaining copy must still render
  // and the removed sentence must not appear in either locale.

  it('guest sub-heading in Arabic renders the remaining copy and omits the removed privacy sentence', () => {
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
        'ar',
      ),
    );
    expect(
      screen.getByText(
        'لإتمام حجز موعدك، سجّل الدخول إلى حسابك أو أنشئ حساباً جديداً.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/بياناتك سرّية ولا تُستخدم خارج المركز/),
    ).toBeNull();
    expect(screen.queryByText(/Your data is private/i)).toBeNull();
  });

  it('guest sub-heading in English renders the remaining copy and omits the removed privacy sentence', () => {
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
    expect(
      screen.getByText('To book, sign in to your account or create one.'),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Your data is private and never leaves the centre/i),
    ).toBeNull();
    expect(screen.queryByText(/بياناتك سرّية/i)).toBeNull();
  });
});
