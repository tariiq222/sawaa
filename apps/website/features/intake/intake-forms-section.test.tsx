import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./intake.api', () => ({
  fetchApplicableIntakeForms: vi.fn(),
  submitIntakeResponse: vi.fn(),
}));

vi.mock('@/lib/public-fetch', () => {
  class FakePublicFetchError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`PublicFetchError: ${status}`);
    }
  }
  return { PublicFetchError: FakePublicFetchError, publicFetch: vi.fn() };
});

import { IntakeFormsSection } from './intake-forms-section';
import { fetchApplicableIntakeForms, submitIntakeResponse } from './intake.api';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

const fetchMock = fetchApplicableIntakeForms as unknown as ReturnType<typeof vi.fn>;
const submitMock = submitIntakeResponse as unknown as ReturnType<typeof vi.fn>;

function wrap(locale: Locale, children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}

const form = {
  id: 'form_1',
  nameAr: 'نموذج',
  nameEn: 'Intake Form',
  type: 'pre_session',
  scope: 'service',
  fields: [
    {
      id: 'f_name',
      labelAr: 'الاسم',
      labelEn: 'Your name',
      fieldType: 'TEXT' as const,
      isRequired: true,
      options: null,
      position: 0,
    },
  ],
};

describe('IntakeFormsSection', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    submitMock.mockReset();
  });

  it('renders nothing without a serviceId', () => {
    const { container } = render(wrap('en', <IntakeFormsSection bookingId="bk1" />));
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders applicable forms and their fields', async () => {
    fetchMock.mockResolvedValue([form]);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getByText('Intake Form')).toBeTruthy());
    expect(screen.getByText('Your name')).toBeTruthy();
  });

  it('blocks submit when a required field is empty', async () => {
    fetchMock.mockResolvedValue([form]);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getByText('Intake Form')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/This field is required/i)).toBeTruthy());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('submits the answers and shows a confirmation on success', async () => {
    fetchMock.mockResolvedValue([form]);
    submitMock.mockResolvedValue(undefined);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getByText('Your name')).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'Sara' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith('bk1', {
        formId: 'form_1',
        answers: { f_name: 'Sara' },
      }),
    );
    await waitFor(() => expect(screen.getByText(/submitted successfully/i)).toBeTruthy());
  });
});
