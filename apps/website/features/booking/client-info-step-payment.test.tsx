import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient } from '@tanstack/react-query';
import { ClientInfoStep } from './client-info-step';
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

describe('ClientInfoStep — payment method gating', () => {
  const signIn = () =>
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

  const stepProps = (onSubmitInfo: () => void) => ({
    slot,
    service,
    employee,
    onSubmitInfo,
    isSubmitting: false,
  });

  it('offers only pay-at-center when online payment is disabled, and submits payAtClinic=true', () => {
    signIn();
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          {...stepProps(onSubmitInfo)}
          paymentMethods={{ moyasarEnabled: false, atClinicEnabled: true }}
        />,
      ),
    );

    expect(screen.queryByRole('radio', { name: /Online payment/i })).toBeNull();
    expect(screen.getByRole('radio', { name: /Pay at the center/i })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Confirm appointment/i }));
    expect(onSubmitInfo).toHaveBeenCalledWith(true);
  });

  it('offers only online payment when pay-at-center is disabled, and submits payAtClinic=false', () => {
    signIn();
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          {...stepProps(onSubmitInfo)}
          paymentMethods={{ moyasarEnabled: true, atClinicEnabled: false }}
        />,
      ),
    );

    expect(screen.queryByRole('radio', { name: /Pay at the center/i })).toBeNull();
    expect(screen.getByRole('radio', { name: /Online payment/i })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Pay/i }));
    expect(onSubmitInfo).toHaveBeenCalledWith(false);
  });

  it('blocks a paid booking and explains why when no payment method is enabled', () => {
    signIn();
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          {...stepProps(onSubmitInfo)}
          paymentMethods={{ moyasarEnabled: false, atClinicEnabled: false }}
        />,
      ),
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText(/No payment method is available/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirm & Pay/i })).toBeDisabled();
    expect(onSubmitInfo).not.toHaveBeenCalled();
  });

  it('shows the pending copy and blocks submission while the capabilities are still loading', () => {
    signIn();
    const onSubmitInfo = vi.fn();
    // Rendered directly: the `Step` helper defaults `paymentMethods` to
    // "everything enabled", which is exactly the state this case is not.
    render(
      withLocale(
        <ClientInfoStep
          {...stepProps(onSubmitInfo)}
          paymentMethods={undefined}
          paymentMethodsLoading
        />,
      ),
    );

    expect(screen.getByText(/Checking the available payment methods/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirm & Pay/i })).toBeDisabled();
  });

  it('drops a selection that is no longer enabled instead of submitting it', () => {
    signIn();
    const onSubmitInfo = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      withLocale(
        <Step
          {...stepProps(onSubmitInfo)}
          paymentMethods={{ moyasarEnabled: true, atClinicEnabled: true }}
        />,
        'en',
        qc,
      ),
    );

    fireEvent.click(screen.getByRole('radio', { name: /Pay at the center/i }));

    // The center turns pay-at-center off while the client is on the step.
    rerender(
      withLocale(
        <Step
          {...stepProps(onSubmitInfo)}
          paymentMethods={{ moyasarEnabled: true, atClinicEnabled: false }}
        />,
        'en',
        qc,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Pay/i }));
    expect(onSubmitInfo).toHaveBeenCalledWith(false);
  });
});
