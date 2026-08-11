import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EmployeeWithUser } from '@sawaa/shared';
import { TherapistPicker } from './therapist-picker';
import { LocaleProvider } from '@/features/locale/locale-provider';

function makeEmployee(overrides: Partial<EmployeeWithUser> = {}): EmployeeWithUser {
  return {
    id: 'emp1',
    userId: 'u1',
    specialty: 'Family therapy',
    specialtyAr: 'علاج أسري',
    bio: null,
    bioAr: null,
    experience: 8,
    education: null,
    educationAr: null,
    rating: 4.7,
    reviewCount: 42,
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
      email: 'layla@sawa.test',
      phone: '+966500000000',
      avatarUrl: null,
    },
    serviceIds: ['svc1'],
    branchIds: ['br1'],
    isBookable: true,
    ...overrides,
  };
}

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('TherapistPicker', () => {
  it('renders the therapist display name under the en locale', () => {
    render(
      withLocale(
        <TherapistPicker
          therapists={[makeEmployee()]}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
  });

  it('renders the Arabic display name under the ar locale', () => {
    render(
      <LocaleProvider locale="ar">
        <TherapistPicker therapists={[makeEmployee()]} selected={null} onSelect={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByText(/د\. ليلى/)).toBeTruthy();
  });

  it('renders the specialty line', () => {
    render(
      withLocale(
        <TherapistPicker
          therapists={[makeEmployee()]}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('Family therapy')).toBeTruthy();
  });

  it('shows the rating + experience meta when both are present', () => {
    render(
      withLocale(
        <TherapistPicker
          therapists={[makeEmployee({ rating: 4.5, reviewCount: 10, experience: 5 })]}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText(/yrs exp/)).toBeTruthy();
  });

  it('hides rating when reviewCount is 0', () => {
    render(
      withLocale(
        <TherapistPicker
          therapists={[makeEmployee({ rating: 0, reviewCount: 0, experience: 5 })]}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByText(/^0\.0$/)).toBeNull();
  });

  it('calls onSelect with the therapist when a card is clicked', () => {
    const onSelect = vi.fn();
    const employee = makeEmployee();
    render(
      withLocale(
        <TherapistPicker therapists={[employee]} selected={null} onSelect={onSelect} />,
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: /Dr\. Layla/ }));
    expect(onSelect).toHaveBeenCalledWith(employee);
  });

  it('marks the selected therapist as aria-checked=true and others as false (no aria-pressed)', () => {
    const emp1 = makeEmployee();
    const emp2 = makeEmployee({ id: 'emp2', nameEn: 'Dr. Nour' });
    render(
      withLocale(
        <TherapistPicker therapists={[emp1, emp2]} selected={emp1} onSelect={vi.fn()} />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[1].getAttribute('aria-checked')).toBe('false');
    expect(radios[0].getAttribute('aria-pressed')).toBeNull();
  });

  it('renders the therapist list as a radiogroup with a localized name', () => {
    render(
      withLocale(
        <TherapistPicker therapists={[makeEmployee()]} selected={null} onSelect={vi.fn()} />,
      ),
    );
    expect(screen.getByRole('radiogroup', { name: /Select Therapist/i })).toBeTruthy();
  });

  it('gives the selected therapist roving tabindex 0 and the rest -1', () => {
    const emp1 = makeEmployee();
    const emp2 = makeEmployee({ id: 'emp2', nameEn: 'Dr. Nour' });
    render(
      withLocale(
        <TherapistPicker therapists={[emp1, emp2]} selected={emp2} onSelect={vi.fn()} />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0].tabIndex).toBe(-1);
    expect(radios[1].tabIndex).toBe(0);
  });

  it('ArrowDown moves to and selects the next therapist, wrapping at the end', () => {
    const onSelect = vi.fn();
    const emp1 = makeEmployee();
    const emp2 = makeEmployee({ id: 'emp2', nameEn: 'Dr. Nour' });
    render(
      withLocale(
        <TherapistPicker therapists={[emp1, emp2]} selected={null} onSelect={onSelect} />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(emp2);
    expect(radios[1]).toHaveFocus();
    fireEvent.keyDown(radios[1], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(emp1);
    expect(radios[0]).toHaveFocus();
  });

  it('Home/End jump to the first/last therapist', () => {
    const onSelect = vi.fn();
    const emp1 = makeEmployee();
    const emp2 = makeEmployee({ id: 'emp2', nameEn: 'Dr. Nour' });
    const emp3 = makeEmployee({ id: 'emp3', nameEn: 'Dr. Sami' });
    render(
      withLocale(
        <TherapistPicker therapists={[emp1, emp2, emp3]} selected={null} onSelect={onSelect} />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith(emp1);
    fireEvent.keyDown(radios[0], { key: 'End' });
    expect(onSelect).toHaveBeenCalledWith(emp3);
  });

  it('renders the empty state when no therapists are available', () => {
    render(
      withLocale(
        <TherapistPicker therapists={[]} selected={null} onSelect={vi.fn()} />,
      ),
    );
    expect(screen.getByText(/No therapists available right now/i)).toBeTruthy();
  });

  it('filters out employees missing their user record', () => {
    const broken = { ...makeEmployee(), user: undefined } as unknown as EmployeeWithUser;
    render(
      withLocale(
        <TherapistPicker
          therapists={[broken]}
          selected={null}
          onSelect={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText(/No therapists available right now/i)).toBeTruthy();
  });
});
