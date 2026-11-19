import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
  it('renders the confirmation card and confirm CTA when authenticated', () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={onSubmitInfo}
          isSubmitting={false}
        />,
      ),
    );
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('+966500000000')).toBeTruthy();
    // Button label is "Confirm & Pay" (en) — match literal "Confirm" and "Pay"
    // tokens with any character between them.
    fireEvent.click(screen.getByRole('button', { name: /Confirm.*Pay/i }));
    expect(onSubmitInfo).toHaveBeenCalled();
  });

  it('defaults to online payment and submits payAtClinic=false', () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={onSubmitInfo}
          isSubmitting={false}
        />,
      ),
    );

    expect(screen.getByRole('radio', { name: /Online payment/i })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Confirm.*Pay/i }));

    expect(onSubmitInfo).toHaveBeenCalledWith(false);
  });

  it('selects pay at the center and submits payAtClinic=true', () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const onSubmitInfo = vi.fn();
    render(
      withLocale(
        <Step
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={onSubmitInfo}
          isSubmitting={false}
        />,
        'ar',
      ),
    );

    fireEvent.click(screen.getByRole('radio', { name: /الدفع في المركز/i }));
    expect(screen.getByRole('radio', { name: /الدفع في المركز/i })).toBeChecked();
    expect(screen.queryByText(/دفع آمن ومشفّر عبر ميسر/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد الموعد/i }));

    expect(onSubmitInfo).toHaveBeenCalledWith(true);
  });

  it('disables the confirm button while isSubmitting is true', () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
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
          isSubmitting
        />,
      ),
    );
    const btn = screen.getByRole('button', { name: /Processing/ });
    expect(btn).toBeDisabled();
  });

  it('renders the VAT-inclusive total when vatRate > 0', () => {
    useCurrentClientMock.mockReturnValue({
      client: fakeClient,
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
          vatRate={0.15}
          selectedPriceHalalas={10000}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    // 10000 halalas + 15% VAT = 11500 halalas = 115 SAR. Intl.NumberFormat in
    // en-US with maximumFractionDigits:2 trims trailing zeros → "115".
    expect(screen.getByText('115')).toBeTruthy();
    expect(screen.getByText(/incl\. VAT/i)).toBeTruthy();
  });

  // === Inline registration mode toggle ===
  // The booking step must never navigate to /register or /login — both
  // would unmount the wizard and drop the chosen service/therapist/slot.
  // Instead it offers a tablist that swaps between the existing inline
  // sign-in form and the embedded RegisterForm.
});
