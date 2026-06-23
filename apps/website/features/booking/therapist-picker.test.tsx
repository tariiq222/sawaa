import { describe, it, expect, vi } from 'vitest';
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
    fireEvent.click(screen.getByRole('button', { name: /Dr\. Layla/ }));
    expect(onSelect).toHaveBeenCalledWith(employee);
  });

  it('marks the selected therapist as aria-pressed=true', () => {
    const selected = makeEmployee();
    render(
      withLocale(
        <TherapistPicker therapists={[selected]} selected={selected} onSelect={vi.fn()} />,
      ),
    );
    const btn = screen.getByRole('button', { name: /Dr\. Layla/ });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
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
