import { describe, it, expect, vi } from 'vitest';
import type { Service } from '@sawaa/shared';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SummaryRail } from './summary-rail';
import { branch, employee, service, slot, withLocale } from './summary-rail.test.helpers';

describe('SummaryRail', () => {
  it('labels a direct booking as a clinic and does not offer to edit its internal service', () => {
    render(withLocale(
      <SummaryRail showBranch={false} branch={null}
        service={{ ...service, isHidden: true, nameAr: 'عيادة السعادة', nameEn: 'Happiness Clinic' }}
        choice={null} employee={null} slot={null} activeScreen="slot" onEdit={vi.fn()} />,
    ));
    expect(screen.getByText('Clinic')).toBeTruthy();
    expect(screen.getByText('Happiness Clinic')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
  });
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

  it('shows only the service name and NO total/duration when service is set without a choice, even if resolvedPriceHalalas is supplied', () => {
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
    // Service name renders.
    expect(screen.getByText('Consultation')).toBeTruthy();
    // No duration subline — the user has not committed a choice yet.
    expect(screen.queryByText(/min/)).toBeNull();
    // No total — even though resolvedPriceHalalas is set, no choice means
    // the summary must suppress price/VAT/total.
    expect(screen.queryByText('100')).toBeNull();
    expect(screen.queryByText(/SAR/)).toBeNull();
    expect(screen.queryByText(/incl\. VAT/)).toBeNull();
  });

  it('shows the chosen duration + delivery + total once a choice is committed', () => {
    const serviceWithConfig: Service = {
      ...service,
      bookingConfigs: [
        { id: 'cfg1', deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
      ],
    } as Service & {
      bookingConfigs?: Array<{
        id: string;
        deliveryType: 'IN_PERSON' | 'ONLINE';
        price: number | string;
        durationMins: number;
      }>;
    };
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={serviceWithConfig}
          choice={{ durationOptionId: 'cfg1', deliveryType: 'IN_PERSON' }}
          employee={null}
          slot={null}
          resolvedPriceHalalas={10000}
        />,
      ),
    );
    // Duration subline now renders.
    expect(screen.getByText(/60 min/)).toBeTruthy();
    // Delivery type subline now renders.
    expect(screen.getByText(/In-person/)).toBeTruthy();
    // Total renders.
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText(/SAR/)).toBeTruthy();
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

  it('does NOT show a browsed date on the time row when only the date is provided (no committed slot)', () => {
    render(
      withLocale(
        <SummaryRail
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
          // pendingDateIso prop was removed; even if a caller still passes it
          // it is silently ignored. The Time row stays empty until a real
          // slot is committed.
          {...({ pendingDateIso: '2026-07-01' } as Record<string, unknown>)}
        />,
      ),
    );
    expect(screen.queryByText(/July/)).toBeNull();
    expect(screen.queryByText(/2026/)).toBeNull();
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
    // The date subline renders too — weekday + day + month.
    expect(screen.getByText(/July/)).toBeTruthy();
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
