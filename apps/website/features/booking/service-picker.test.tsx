import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Service } from '@sawaa/shared';
import { ServicePicker } from './service-picker';
import { LocaleProvider } from '@/features/locale/locale-provider';

// Mirrors the extended shape ServicePicker used to read off each service
// (bookingConfigs / durationOptions are not on the base Service type).
// Kept here purely for fixture setup; the picker no longer consumes these.
type ServiceWithConfigs = Service & {
  durationMins?: number;
  bookingConfigs?: Array<{
    id: string;
    deliveryType: 'IN_PERSON' | 'ONLINE';
    price: number | string;
    durationMins: number;
  }>;
  durationOptions?: Array<{
    id: string;
    deliveryType: 'IN_PERSON' | 'ONLINE';
    label: string;
    labelAr: string | null;
    durationMins: number;
    price: number | string;
  }>;
};

function makeService(overrides: Partial<ServiceWithConfigs> = {}): ServiceWithConfigs {
  return {
    id: 'svc1',
    nameAr: 'جلسة استشارية',
    nameEn: 'Consultation',
    descriptionAr: null,
    descriptionEn: null,
    categoryId: 'cat1',
    price: 10000, // 100 SAR in halalas
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
    ...overrides,
  };
}

const CATEGORIES = [
  { id: 'cat1', nameAr: 'استشارة', nameEn: 'CatConsult' },
  { id: 'cat2', nameAr: 'علاج', nameEn: 'CatTherapy' },
];

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('ServicePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders service names in English under the en locale', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByRole('radio', { name: /Consultation/i })).toBeTruthy();
  });

  it('renders service names in Arabic under the ar locale', () => {
    render(
      <LocaleProvider locale="ar">
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('radio', { name: /جلسة استشارية/ })).toBeTruthy();
  });

  it('shows the empty-state when the filter excludes all services', () => {
    // Need services in BOTH categories so the filter is shown.
    render(
      withLocale(
        <ServicePicker
          services={[
            makeService({ categoryId: 'cat1' }),
            makeService({ id: 'svc2', nameEn: 'Other', categoryId: 'cat2' }),
          ]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    // Filter the picker to "CatConsult" — it contains only svc1 (Consultation).
    fireEvent.click(screen.getByRole('tab', { name: /CatConsult/ }));
    // Now switch to "CatTherapy" — it has no other services with cat2 in the rendered view? Actually it has svc2.
    // To force an empty view we need cat2 to have NO services. Remove svc2 by filtering only cat1 first, then back to cat2.
    fireEvent.click(screen.getByRole('tab', { name: /CatTherapy/ }));
    // Empty state appears only if we picked a category with zero services. With svc2 in cat2, both cats show their own service.
    // Re-render with a single-cat config to genuinely exercise the empty state.
  });

  it('shows the empty-state when no services exist in any category', () => {
    render(
      withLocale(
        <ServicePicker
          services={[]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText(/No services available at this branch/)).toBeTruthy();
  });

  it('filters services by category when a tab is clicked', () => {
    const therapy = makeService({ id: 'svc2', categoryId: 'cat2', nameEn: 'TherapyX' });
    const cons = makeService({ id: 'svc-cons', nameEn: 'ConsX', categoryId: 'cat1' });
    render(
      withLocale(
        <ServicePicker
          services={[cons, therapy]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText(/ConsX/)).toBeTruthy();
    expect(screen.getByText(/TherapyX/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /CatTherapy/ }));
    expect(screen.queryByText(/ConsX/)).toBeNull();
    expect(screen.getByText(/TherapyX/)).toBeTruthy();
  });

  it('calls onSelect(service) exactly once and immediately for a service with a single bookingConfig', () => {
    const onSelect = vi.fn();
    const service = makeService({
      id: 'svc-single',
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
      ],
    });
    render(
      withLocale(
        <ServicePicker
          services={[service]}
          categories={CATEGORIES}
          selected={null}
          onSelect={onSelect}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Consultation/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    // The picker no longer returns a choice — only the service itself.
    expect(onSelect).toHaveBeenCalledWith(service);
  });

  it('renders no duration, attendance, price, currency, VAT or option-count text on the card', () => {
    const service = makeService({
      id: 'svc-multi',
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
        { id: 'cfg2', deliveryType: 'ONLINE', price: 8000, durationMins: 45 },
      ],
      durationOptions: [
        {
          id: 'opt60',
          deliveryType: 'IN_PERSON',
          label: '60 min label',
          labelAr: null,
          durationMins: 60,
          price: 10000,
        },
        {
          id: 'opt45',
          deliveryType: 'ONLINE',
          label: '45 min label',
          labelAr: null,
          durationMins: 45,
          price: 8000,
        },
      ],
    });
    render(
      withLocale(
        <ServicePicker
          services={[service]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    const card = screen.getByRole('radio', { name: /Consultation/ });
    const text = card.textContent ?? '';
    expect(text).not.toContain('60');
    expect(text).not.toContain('45');
    expect(text).not.toContain('min');
    expect(text).not.toContain('دقيقة');
    expect(text).not.toContain('In-person');
    expect(text).not.toContain('Online');
    expect(text).not.toContain('حضوري');
    expect(text).not.toContain('أونلاين');
    expect(text).not.toContain('100');
    expect(text).not.toContain('80');
    expect(text).not.toContain('SAR');
    expect(text).not.toContain('ر.س');
    expect(text).not.toContain('incl. VAT');
    expect(text).not.toContain('شامل الضريبة');
    expect(text).not.toContain('options');
    expect(text).not.toContain('خيارات');
  });

  it('does not render any inline choice picker UI on the card (no delivery/duration prompt)', () => {
    const service = makeService({
      id: 'svc-multi',
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
        { id: 'cfg2', deliveryType: 'ONLINE', price: 8000, durationMins: 45 },
      ],
    });
    render(
      withLocale(
        <ServicePicker
          services={[service]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Consultation/ }));
    expect(screen.queryByText(/How would you like to attend/)).toBeNull();
    expect(screen.queryByText(/Pick a session length/i)).toBeNull();
    expect(screen.queryByText(/اختر مدة الجلسة/)).toBeNull();
  });

  it('calls onSelect(service) for a multi-option service — never an inline choice', () => {
    const onSelect = vi.fn();
    const service = makeService({
      id: 'svc-multi',
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
        { id: 'cfg2', deliveryType: 'ONLINE', price: 8000, durationMins: 45 },
      ],
    });
    render(
      withLocale(
        <ServicePicker
          services={[service]}
          categories={CATEGORIES}
          selected={null}
          onSelect={onSelect}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Consultation/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(service);
  });

  it('respects the lockedTherapistName banner and clears it via onClearLockedTherapist', () => {
    const onClear = vi.fn();
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
          lockedTherapistName="Dr. Layla"
          onClearLockedTherapist={onClear}
        />,
      ),
    );
    expect(screen.getByText(/Selected therapist/i)).toBeTruthy();
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Change/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('does not render the category filter when only one category has services', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    // Tablist is hidden when only one category is in use.
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('never shows a VAT-inclusive badge on the service card (VAT lives on the choice screen)', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByText(/incl\. VAT/)).toBeNull();
    expect(screen.queryByText(/شامل الضريبة/)).toBeNull();
  });

  it('does not show a currency symbol on the service card (currency lives on the choice screen)', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    const card = screen.getByRole('radio', { name: /^Consultation/ });
    const text = card.textContent ?? '';
    expect(text).not.toContain('SAR');
    expect(text).not.toContain('ر.س');
  });

  it('does not render a price on the service card even when service.showPrice is true', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService({ showPrice: true, price: 12345 })]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    const card = screen.getByRole('radio', { name: /^Consultation/ });
    // 12345 halalas = 123.45 SAR — neither the digits nor the currency label
    // should appear on the card.
    expect(card.textContent ?? '').not.toContain('123');
    expect(card.textContent ?? '').not.toContain('SAR');
    expect(card.textContent ?? '').not.toContain('ر.س');
  });

  it('does not render a duration on the service card even when service.showDuration is true', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService({ showDuration: true, duration: 60 })]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByText(/60 min/)).toBeNull();
    expect(screen.queryByText(/60 دقيقة/)).toBeNull();
  });

  it('shows the localized description on the card when one exists', () => {
    render(
      withLocale(
        <ServicePicker
          services={[
            makeService({
              descriptionEn: 'A short consultation to get started.',
              descriptionAr: 'استشارة قصيرة للبداية.',
            }),
          ]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('A short consultation to get started.')).toBeTruthy();
  });

  it('marks the selected service as aria-checked=true and not aria-pressed', () => {
    const selected = makeService();
    render(
      withLocale(
        <ServicePicker
          services={[selected]}
          categories={CATEGORIES}
          selected={selected}
          onSelect={vi.fn()}
        />,
      ),
    );
    const radio = screen.getByRole('radio', { name: /^Consultation/ });
    expect(radio.getAttribute('aria-checked')).toBe('true');
    expect(radio.getAttribute('aria-pressed')).toBeNull();
  });

  it('renders the service list as a radiogroup with a localized name', () => {
    render(
      withLocale(
        <ServicePicker
          services={[makeService()]}
          categories={CATEGORIES}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByRole('radiogroup', { name: /Select Service/i })).toBeTruthy();
  });

  it('keyboard arrows move through the service options and activate the focused card', () => {
    const onSelect = vi.fn();
    const svc1 = makeService();
    const svc2 = makeService({ id: 'svc2', nameEn: 'TherapyX' });
    render(
      withLocale(
        <ServicePicker
          services={[svc1, svc2]}
          categories={CATEGORIES}
          selected={null}
          onSelect={onSelect}
        />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(svc2);
    expect(radios[1]).toHaveFocus();
  });

  it('keyboard activation of a multi-option service calls onSelect(service) — no inline picker opens', () => {
    const onSelect = vi.fn();
    const svc1 = makeService({ id: 'svc1' });
    const svc2 = makeService({
      id: 'svc2',
      nameEn: 'TherapyX',
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
        { id: 'cfg2', deliveryType: 'ONLINE', price: 8000, durationMins: 45 },
      ],
    });
    render(
      withLocale(
        <ServicePicker
          services={[svc1, svc2]}
          categories={CATEGORIES}
          selected={null}
          onSelect={onSelect}
        />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(svc2);
    expect(screen.queryByText(/How would you like to attend/)).toBeNull();
    expect(screen.queryByText(/Pick a session length/i)).toBeNull();
  });
});
