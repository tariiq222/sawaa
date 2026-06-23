import { describe, it, expect, vi } from 'vitest';
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
    // The login form has placeholder-based inputs (no id/htmlFor wiring);
    // assert the inputs are present via their placeholders.
    expect(screen.getByPlaceholderText('name@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('requires both email and password before calling the API', async () => {
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
      await screen.findByText(/Please enter email and password/),
    ).toBeTruthy();
    expect(clientLoginApiMock).not.toHaveBeenCalled();
  });

  it('calls clientLoginApi then getMeApi then refetch on successful inline login', async () => {
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
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'sara@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Secret1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(clientLoginApiMock).toHaveBeenCalledWith({
      email: 'sara@test.com',
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
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'a@b.co' },
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
});
