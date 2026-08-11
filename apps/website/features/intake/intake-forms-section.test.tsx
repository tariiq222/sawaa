import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

const multiFieldForm = {
  id: 'form_2',
  nameAr: 'نموذج متعدد',
  nameEn: 'Multi Form',
  type: 'pre_session',
  scope: 'service',
  fields: [
    {
      id: 'f_notes',
      labelAr: 'ملاحظات',
      labelEn: 'Notes',
      fieldType: 'TEXTAREA' as const,
      isRequired: false,
      options: null,
      position: 0,
    },
    {
      id: 'f_age',
      labelAr: 'العمر',
      labelEn: 'Age',
      fieldType: 'NUMBER' as const,
      isRequired: false,
      options: null,
      position: 1,
    },
    {
      id: 'f_date',
      labelAr: 'التاريخ المفضل',
      labelEn: 'Preferred date',
      fieldType: 'DATE' as const,
      isRequired: false,
      options: null,
      position: 2,
    },
    {
      id: 'f_city',
      labelAr: 'المدينة',
      labelEn: 'City',
      fieldType: 'SELECT' as const,
      isRequired: false,
      options: ['Riyadh', 'Jeddah'],
      position: 3,
    },
    {
      id: 'f_radio',
      labelAr: 'التفضيل',
      labelEn: 'Preference',
      fieldType: 'RADIO' as const,
      isRequired: false,
      options: ['Morning', 'Evening'],
      position: 4,
    },
    {
      id: 'f_cb',
      labelAr: 'الاهتمامات',
      labelEn: 'Interests',
      fieldType: 'CHECKBOX' as const,
      isRequired: false,
      options: ['Anxiety', 'Sleep'],
      position: 5,
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

  it('programmatically labels TEXT, TEXTAREA, NUMBER, DATE and SELECT fields', async () => {
    fetchMock.mockResolvedValue([multiFieldForm]);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getByText('Multi Form')).toBeTruthy());
    expect(screen.getByLabelText('Notes')).toHaveAttribute('id');
    expect(screen.getByLabelText('Age')).toHaveAttribute('id');
    expect(screen.getByLabelText('Preferred date')).toHaveAttribute('id');
    expect(screen.getByLabelText('City')).toHaveAttribute('id');
  });

  it('assigns unique ids to equal-label fields across different forms', async () => {
    fetchMock.mockResolvedValue([
      { ...form, id: 'form_a' },
      { ...form, id: 'form_b' },
    ]);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getAllByText('Your name')).toHaveLength(2));
    // Regex: the required-field label also contains the "*" marker.
    const inputs = screen.getAllByLabelText(/Your name/i);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute('id');
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });

  it('keeps fieldset/legend grouping for RADIO and CHECKBOX fields', async () => {
    fetchMock.mockResolvedValue([multiFieldForm]);
    render(wrap('en', <IntakeFormsSection bookingId="bk1" serviceId="svc1" />));
    await waitFor(() => expect(screen.getByText('Multi Form')).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Preference' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Interests' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});
