import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { ClientInfoStep } from './client-info-step';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const useCurrentClientMock = vi.fn();
const clientLoginApiMock = vi.fn();
const getMeApiMock = vi.fn();
const setClientMock = vi.fn();
// Captured so individual tests can fire onSuccess() to exercise the
// inline-registration completion path without rendering the real 3-step form.
const registerFormProps: { onSuccess?: () => void } = {};

vi.mock('@/features/auth/use-current-client', () => ({
  useCurrentClient: () => useCurrentClientMock(),
}));
vi.mock('@/features/auth/auth.api', () => ({
  clientLoginApi: (...args: unknown[]) => clientLoginApiMock(...args),
  getMeApi: (...args: unknown[]) => getMeApiMock(...args),
}));
vi.mock('@/features/auth/auth-store', () => ({
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

const fakeClient = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: '+966500000000',
  emailVerified: '2026-01-01T00:00:00.000Z',
  phoneVerified: null,
  accountType: 'REGISTERED' as const,
  claimedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const slot: AvailableSlot = {
  startTime: '2026-07-01T14:00:00.000Z',
  endTime: '2026-07-01T15:00:00.000Z',
};

const service: Service = {
  id: 'svc1',
  nameAr: 'استشارة',
  nameEn: 'Consultation',
  descriptionAr: null,
  descriptionEn: null,
  categoryId: 'cat1',
  price: 10000,
  duration: 60,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  bufferMinutes: 0,
  depositEnabled: false,
  depositPercent: null,
  maxParticipants: 1,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const employee: EmployeeWithUser = {
  id: 'emp1',
  userId: 'u1',
  specialty: null,
  specialtyAr: null,
  bio: null,
  bioAr: null,
  experience: 0,
  education: null,
  educationAr: null,
  rating: 0,
  reviewCount: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  nameAr: 'د. ليلى',
  nameEn: 'Dr. Layla',
  user: {
    id: 'u1',
    firstName: 'Layla',
    lastName: 'K.',
    email: 'l@sawa.test',
    phone: null,
    avatarUrl: null,
  },
};

function withLocale(children: ReactNode, locale: 'ar' | 'en' = 'en') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
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
        <ClientInfoStep
          slot={slot}
          service={service}
          employee={employee}
          onSubmitInfo={vi.fn()}
          isSubmitting={false}
        />,
      ),
    );
    expect(screen.getByText(/Checking your account/i)).toBeTruthy();
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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

  it('calls clientLoginApi with a normalized phone then getMeApi then refetch on successful inline login', async () => {
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
        <ClientInfoStep
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
    await waitFor(() => expect(refetch).toHaveBeenCalled());
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
    fireEvent.click(screen.getByRole('button', { name: /تأكيد الحجز/i }));

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
        <ClientInfoStep
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
        <ClientInfoStep
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

  it('default mode renders the sign-in form (phone + password) and no register form yet', () => {
    useCurrentClientMock.mockReturnValue({
      client: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      withLocale(
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
        <ClientInfoStep
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
