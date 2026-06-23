import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { SummaryRail, SummaryChips } from './summary-rail';
import type { PublicBranch } from './booking.api';
import { LocaleProvider } from '@/features/locale/locale-provider';

// Pin TZ to UTC so time formatting (`02:00 PM` for 14:00) is deterministic.
process.env.TZ = 'UTC';

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

const branch: PublicBranch = {
  id: 'br1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  city: 'Riyadh',
  addressAr: null,
  isMain: true,
};

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('SummaryRail', () => {
  it('renders an empty row for each screen when nothing is selected', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    expect(screen.getByText('Service')).toBeTruthy();
    expect(screen.getByText('Therapist')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
  });

  it('shows the service name and total when service is set', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
          resolvedPriceHalalas={10000}
        />,
      ),
    );
    expect(screen.getByText('Consultation')).toBeTruthy();
    // 10000 halalas = 100 SAR; Intl.NumberFormat in en-US with only
    // maximumFractionDigits:2 trims trailing zeros → "100", not "100.00".
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('shows the branch row when showBranch=true and branch is set', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch
          branch={branch}
          service={null}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    // The dt label is the exact text "Branch" (booking.step.branch key) and
    // the dd value is "Main Branch" — match each by full text to disambiguate.
    expect(screen.getByText('Branch')).toBeTruthy();
    expect(screen.getByText('Main Branch')).toBeTruthy();
  });

  it('hides the branch row entirely when showBranch=false', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    expect(screen.queryByText(/Branch/i)).toBeNull();
  });

  it('shows the therapist name when employee is selected', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={employee}
          slot={null}
        />,
      ),
    );
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
  });

  it('shows the pending date when pendingDateIso is set but slot is null', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
          pendingDateIso="2026-07-01"
        />,
      ),
    );
    // The date should render in the slot row.
    expect(screen.getByText(/July/)).toBeTruthy();
  });

  it('shows the chosen slot time when slot is selected', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={slot}
        />,
      ),
    );
    // TZ is pinned to UTC → 2026-07-01T14:00:00.000Z renders as "02:00 PM" in
    // the en-US locale. Assert the time sub-line exactly.
    expect(screen.getByText('02:00 PM')).toBeTruthy();
  });

  it('does not render edit affordances when onEdit is undefined', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: /Change/i })).toBeNull();
  });

  it('calls onEdit when the Change button is clicked on a non-active row', () => {
    const onEdit = vi.fn();
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={employee}
          slot={null}
          activeScreen="therapist"
          onEdit={onEdit}
        />,
      ),
    );
    // Service row Change button is clickable (activeScreen is therapist).
    const changeButtons = screen.getAllByRole('button', { name: /Change/i });
    fireEvent.click(changeButtons[0]);
    expect(onEdit).toHaveBeenCalledWith('service');
  });

  it('hides the Change button for the currently-active screen', () => {
    const onEdit = vi.fn();
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={employee}
          slot={null}
          activeScreen="service"
          onEdit={onEdit}
        />,
      ),
    );
    // Service is the active screen so its Change button is hidden; therapist
    // is filled and not active so it shows one Change button.
    const changeButtons = screen.getAllByRole('button', { name: /Change/i });
    expect(changeButtons).toHaveLength(1);
  });
});

describe('SummaryChips', () => {
  it('renders nothing when no rows are filled', () => {
    const { container } = render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip for each filled selection', () => {
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={employee}
          slot={null}
        />,
      ),
    );
    expect(screen.getByText('Consultation')).toBeTruthy();
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
  });

  it('tappable chips route to onEdit', () => {
    const onEdit = vi.fn();
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
          activeScreen={null}
          onEdit={onEdit}
        />,
      ),
    );
    // The service chip is a button (activeScreen is null so all filled rows are tappable).
    const chip = screen.getByRole('button', { name: /Consultation/ });
    fireEvent.click(chip);
    expect(onEdit).toHaveBeenCalledWith('service');
  });

  it('renders the active screen chip as a non-interactive span', () => {
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
          activeScreen="service"
          onEdit={vi.fn()}
        />,
      ),
    );
    // The chip should not be a button when it is the active screen.
    expect(screen.queryByRole('button', { name: /Consultation/ })).toBeNull();
    // The text content is still rendered.
    expect(screen.getByText('Consultation')).toBeTruthy();
  });
});
