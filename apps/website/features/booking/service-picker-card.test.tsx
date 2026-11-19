import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServicePicker } from './service-picker';
import { CATEGORIES, makeService, withLocale } from './service-picker.test.fixtures';

describe('ServicePicker — card content and keyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
